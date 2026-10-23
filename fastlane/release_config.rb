require 'json'
require 'tmpdir'
require 'fileutils'

module PlayRelease
  ROOT = File.expand_path('..', __dir__)
  PACKAGE_NAME = 'com.graphenelab.cloudexplorer'
  AAB_PATH = File.join(ROOT, 'android/app/build/outputs/bundle/release/app-release.aab')

  def self.version_info(root: ROOT, env: ENV)
    package = JSON.parse(File.read(File.join(root, 'package.json')))
    expo = JSON.parse(File.read(File.join(root, 'app.json'))).fetch('expo')
    gradle = File.read(File.join(root, 'android/app/build.gradle'))
    version = package.fetch('version')
    gradle_version = gradle[/\bversionName\s+"([^"]+)"/, 1]
    code = gradle[/\bversionCode\s+(\d+)/, 1]

    unless version.match?(/\A\d+\.\d+\.\d+\z/) &&
           [expo.fetch('version'), gradle_version].all? { |value| value == version }
      raise ArgumentError, 'Versions in package.json, app.json and Android Gradle must match.'
    end
    unless expo.fetch('android').fetch('package') == PACKAGE_NAME &&
           gradle[/\bapplicationId\s+'([^']+)'/, 1] == PACKAGE_NAME
      raise ArgumentError, 'The Android package must be com.graphenelab.cloudexplorer.'
    end
    unless code && code.to_i.between?(1, 2_100_000_000)
      raise ArgumentError, 'Android versionCode must be between 1 and 2100000000.'
    end
    if env['GITHUB_REF_TYPE'] == 'tag' && env['GITHUB_REF_NAME'] != "v#{version}"
      raise ArgumentError, "Release tag must be v#{version}."
    end

    { name: version, code: code.to_i }
  end

  def self.signing_store(env: ENV)
    keys = %w[APP_UPLOAD_STORE_FILE APP_UPLOAD_STORE_PASSWORD APP_UPLOAD_KEY_ALIAS APP_UPLOAD_KEY_PASSWORD]
    missing = keys.reject { |key| !env["ORG_GRADLE_PROJECT_#{key}"].to_s.strip.empty? }
    raise ArgumentError, "Missing signing properties: #{missing.join(', ')}" unless missing.empty?

    path = env.fetch('ORG_GRADLE_PROJECT_APP_UPLOAD_STORE_FILE')
    raise ArgumentError, 'The upload keystore file is missing.' unless File.file?(path)

    path
  end

  def self.read_notes(filename, limit: nil)
    raise ArgumentError, "Missing release notes: #{filename}" unless File.file?(filename)

    text = File.read(filename, encoding: 'bom|utf-8').strip
    unless text.valid_encoding? && !text.gsub(/<!--.*?-->/m, '').strip.empty? && !text.include?('RELEASE_NOTES_TODO')
      raise ArgumentError, "Fill in the release notes before publishing: #{filename}"
    end
    raise ArgumentError, "Play release notes must be at most #{limit} Unicode characters: #{filename}" if limit && text.length > limit

    text
  end

  def self.play_notes(code, root: ROOT)
    unless code.is_a?(Integer) && code.between?(1, 2_100_000_000)
      raise ArgumentError, 'Invalid release-notes versionCode.'
    end
    metadata = File.join(root, 'fastlane/metadata/android')
    english = File.join(metadata, 'en-US/changelogs', "#{code}.txt")
    notes = { 'en-US' => read_notes(english, limit: 500) }
    Dir.glob(File.join(metadata, '*/changelogs', "#{code}.txt")).sort.each do |filename|
      language = File.basename(File.dirname(File.dirname(filename)))
      raise ArgumentError, "Invalid release-notes language: #{language}" unless language.match?(/\A[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*\z/)
      next if language == 'en-US'

      notes[language] = read_notes(filename, limit: 500)
    end
    notes
  end

  def self.release_info(destination, root: ROOT, env: ENV)
    raise ArgumentError, 'Select github, play, or both as the release destination.' unless %w[github play both].include?(destination)

    version = version_info(root: root, env: env)
    if destination != 'play'
      version[:github_notes] = read_notes(File.join(root, 'release-notes', "#{version[:name]}.md"))
    end
    play_notes(version[:code], root: root) if destination != 'github'
    version
  end

  def self.credentials_file(env: ENV)
    path = env['GOOGLE_APPLICATION_CREDENTIALS'].to_s
    raise ArgumentError, 'Google authentication credentials are missing.' unless File.file?(path)

    path
  end

  def self.promotion_version(value, internal_versions:, production_versions:)
    if value.to_s.strip.empty?
      value = internal_versions.map(&:to_i).max
      raise ArgumentError, 'No version is available on the internal testing track.' unless value
    end
    unless value.to_s.match?(/\A[1-9]\d*\z/) && value.to_i <= 2_100_000_000
      raise ArgumentError, 'Provide a positive version_code, or leave it blank for the latest internal version.'
    end
    code = value.to_i
    unless internal_versions.map(&:to_i).include?(code)
      raise ArgumentError, "Version #{code} is not on the internal testing track."
    end
    if production_versions.map(&:to_i).any? { |released| released >= code }
      raise ArgumentError, 'Production already contains this version or a newer version.'
    end

    code
  end
end
