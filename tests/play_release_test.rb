require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'
require_relative '../fastlane/release_config'

class PlayReleaseTest < Minitest::Test
  def with_project
    Dir.mktmpdir('explorer-release-test-') do |root|
      FileUtils.mkdir_p(File.join(root, 'android/app'))
      File.write(File.join(root, 'package.json'), JSON.generate(version: '1.2.7'))
      File.write(File.join(root, 'app.json'), JSON.generate(expo: { version: '1.2.7', android: { package: PlayRelease::PACKAGE_NAME } }))
      File.write(File.join(root, 'android/app/build.gradle'), "applicationId '#{PlayRelease::PACKAGE_NAME}'\nversionName \"1.2.7\"\nversionCode 31\n")
      yield root
    end
  end

  def test_matching_versions_and_tag
    with_project do |root|
      result = PlayRelease.version_info(root: root, env: { 'GITHUB_REF_TYPE' => 'tag', 'GITHUB_REF_NAME' => 'v1.2.7' })
      assert_equal({ name: '1.2.7', code: 31 }, result)
    end
  end

  def test_mismatched_version_and_release_tag_are_rejected
    with_project do |root|
      assert_raises(ArgumentError) { PlayRelease.version_info(root: root, env: { 'GITHUB_REF_TYPE' => 'tag', 'GITHUB_REF_NAME' => 'v1.2.8' }) }
      File.write(File.join(root, 'package.json'), JSON.generate(version: '1.2.8'))
      assert_raises(ArgumentError) { PlayRelease.version_info(root: root, env: {}) }
    end
  end

  def test_another_package_is_rejected
    with_project do |root|
      File.write(File.join(root, 'app.json'), JSON.generate(expo: { version: '1.2.7', android: { package: 'another.app' } }))
      assert_raises(ArgumentError) { PlayRelease.version_info(root: root, env: {}) }
    end
  end

  def test_signing_fails_without_password_or_keystore
    Dir.mktmpdir do |root|
      path = File.join(root, 'upload.keystore')
      env = %w[APP_UPLOAD_STORE_PASSWORD APP_UPLOAD_KEY_ALIAS APP_UPLOAD_KEY_PASSWORD].to_h { |key| ["ORG_GRADLE_PROJECT_#{key}", 'test-value'] }
      env['ORG_GRADLE_PROJECT_APP_UPLOAD_STORE_FILE'] = path
      assert_raises(ArgumentError) { PlayRelease.signing_store(env: env) }
      File.write(path, 'test-keystore')
      assert_equal path, PlayRelease.signing_store(env: env)
      env.delete('ORG_GRADLE_PROJECT_APP_UPLOAD_KEY_PASSWORD')
      assert_raises(ArgumentError) { PlayRelease.signing_store(env: env) }
    end
  end

  def test_missing_google_credentials_are_rejected
    assert_raises(ArgumentError) { PlayRelease.credentials_file(env: {}) }
  end

  def test_promotion_selects_the_requested_tested_version
    assert_equal 31, PlayRelease.promotion_version('31', internal_versions: [31, 32], production_versions: [30])
  end

  def test_promotion_rejects_missing_unpublished_or_older_versions
    ['', '0', '-1', 'latest', '31; echo unsafe', '2100000001'].each do |value|
      assert_raises(ArgumentError) { PlayRelease.promotion_version(value, internal_versions: [31], production_versions: [30]) }
    end
    assert_raises(ArgumentError) { PlayRelease.promotion_version('32', internal_versions: [31], production_versions: [30]) }
    assert_raises(ArgumentError) { PlayRelease.promotion_version('31', internal_versions: [31], production_versions: [31]) }
  end
end

# Run the real lane bodies with Google Play and Gradle replaced by in-memory adapters.
module UI
  def self.user_error!(message)
    raise ArgumentError, message
  end

  def self.message(_message); end
end

class PublishingLanes
  attr_reader :uploads, :track_reads

  def initialize
    @lanes = {}
    @uploads = []
    @track_reads = []
    filename = File.expand_path('../fastlane/Fastfile', __dir__)
    instance_eval(File.read(filename), filename)
  end

  def default_platform(_name); end
  def desc(_description); end
  def platform(_name, &block) = block.call
  def lane(name, &block) = @lanes[name] = block
  def run(name, options = {}) = @lanes.fetch(name).call(options)

  def google_play_track_version_codes(**options)
    @track_reads << options.fetch(:track)
    options.fetch(:track) == 'internal' ? [31, 32] : [30]
  end

  def upload_to_play_store(**options) = @uploads << options
  def gradle(**_options) = raise('A promotion must not build the app.')
end

class PublishingLanesTest < Minitest::Test
  def with_credentials
    Dir.mktmpdir do |root|
      previous = ENV['GOOGLE_APPLICATION_CREDENTIALS']
      path = File.join(root, 'test-credentials.json')
      File.write(path, '{}')
      ENV['GOOGLE_APPLICATION_CREDENTIALS'] = path
      begin
        yield
      ensure
        ENV['GOOGLE_APPLICATION_CREDENTIALS'] = previous
      end
    end
  end

  def test_production_promotes_only_the_requested_version_without_building
    with_credentials do
      lanes = PublishingLanes.new
      lanes.run(:promote, version_code: '31')
      assert_equal %w[internal production], lanes.track_reads
      assert_equal 1, lanes.uploads.length
      request = lanes.uploads.first
      assert_equal 31, request.fetch(:version_code)
      assert_equal 'internal', request.fetch(:track)
      assert_equal 'production', request.fetch(:track_promote_to)
      assert_equal 'completed', request.fetch(:release_status)
      assert request.fetch(:skip_upload_aab)
      assert request.fetch(:skip_upload_apk)
    end
  end

  def test_missing_promotion_selection_stops_before_any_api_call
    lanes = PublishingLanes.new
    assert_raises(ArgumentError) { lanes.run(:promote) }
    assert_empty lanes.track_reads
    assert_empty lanes.uploads
  end

  def test_untested_version_never_reaches_the_upload_action
    with_credentials do
      lanes = PublishingLanes.new
      assert_raises(ArgumentError) { lanes.run(:promote, version_code: '33') }
      assert_empty lanes.uploads
    end
  end

  def test_internal_upload_uses_the_selected_build_versions_without_rebuilding
    with_credentials do
      Dir.mktmpdir do |source|
        FileUtils.mkdir_p(File.join(source, 'android/app'))
        File.write(File.join(source, 'package.json'), JSON.generate(version: '9.8.7'))
        File.write(File.join(source, 'app.json'), JSON.generate(expo: { version: '9.8.7', android: { package: PlayRelease::PACKAGE_NAME } }))
        File.write(File.join(source, 'android/app/build.gradle'), "applicationId '#{PlayRelease::PACKAGE_NAME}'\nversionName \"9.8.7\"\nversionCode 33\n")
        previous = ENV['PLAY_RELEASE_SOURCE']
        ENV['PLAY_RELEASE_SOURCE'] = source
        original_file = File.method(:file?)
        begin
          lanes = PublishingLanes.new
          File.stub(:file?, ->(filename) { filename == PlayRelease::AAB_PATH || original_file.call(filename) }) do
            lanes.run(:internal)
          end
          assert_equal %w[internal production], lanes.track_reads
          assert_equal 1, lanes.uploads.length
          request = lanes.uploads.first
          assert_equal '9.8.7 (33)', request.fetch(:version_name)
          assert_equal PlayRelease::AAB_PATH, request.fetch(:aab)
          assert_equal 'internal', request.fetch(:track)
        ensure
          ENV['PLAY_RELEASE_SOURCE'] = previous
        end
      end
    end
  end
end
