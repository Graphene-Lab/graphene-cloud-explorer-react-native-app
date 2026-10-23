require 'minitest/autorun'
require 'tmpdir'
require 'ostruct'
require_relative '../scripts/download-play-apk'

class PlayApkTest < Minitest::Test
  CERTIFICATE = '99B61E211DF16690313C089D3F9C3DC2D7A9B92040D79F64B0BF63FBAD2DDA98'
  VERSION = { 'name' => '1.2.8', 'code' => 32 }.freeze
  ApiError = Class.new(StandardError) do
    attr_reader :status_code
    def initialize(code)
      @status_code = code
      super('Sensitive server details must not be required by the downloader.')
    end
  end

  class Service
    attr_reader :reads, :downloads
    def initialize(*responses, fail_download: false)
      @responses, @reads, @downloads, @fail_download = responses, [], [], fail_download
    end

    def list_generatedapks(package, code)
      @reads << [package, code]
      response = @responses.length > 1 ? @responses.shift : @responses.first
      raise response if response.is_a?(Exception)
      OpenStruct.new(generated_apks: response)
    end

    def download_generatedapk(package, code, id, download_dest:)
      @downloads << [package, code, id]
      download_dest.write('APK contents')
      raise 'Download interrupted' if @fail_download
    end
  end

  def group(certificate: CERTIFICATE, id: 'universal-apk')
    OpenStruct.new(certificate_sha256_hash: certificate, generated_universal_apk: id ? OpenStruct.new(download_id: id) : nil)
  end

  def download(service, directory, **options)
    PlayApk.download(service: service, version: VERSION, directory: directory, certificate: CERTIFICATE, attempts: 3, **options)
  end

  def test_downloads_only_the_universal_apk_for_the_expected_signing_key
    Dir.mktmpdir do |directory|
      service = Service.new([group(certificate: 'a' * 64, id: 'wrong-key'), group])
      filename = download(service, directory)
      assert_equal 'Graphene-Cloud-Explorer-1.2.8.apk', File.basename(filename)
      assert_equal 'APK contents', File.read(filename)
      assert_equal [[PlayRelease::PACKAGE_NAME, 32, 'universal-apk']], service.downloads
    end
  end

  def test_waits_for_processing_without_rebuilding_or_uploading
    Dir.mktmpdir do |directory|
      service = Service.new([], [group(id: nil)], [group])
      waits = 0
      download(service, directory, wait: -> { waits += 1 })
      assert_equal 2, waits
      assert_equal 3, service.reads.length
      assert_equal 1, service.downloads.length
    end
  end

  def test_retries_transient_not_found_then_downloads
    Dir.mktmpdir do |directory|
      service = Service.new(ApiError.new(404), [group])
      download(service, directory, wait: -> {})
      assert_equal 2, service.reads.length
    end
  end

  def test_certificate_mismatch_stops_without_downloading
    Dir.mktmpdir do |directory|
      service = Service.new([group(certificate: 'a' * 64)])
      assert_raises(ArgumentError) { download(service, directory, wait: -> { flunk }) }
      assert_empty service.downloads
      assert_empty Dir.children(directory)
    end
  end

  def test_permissions_fail_immediately_without_polling
    Dir.mktmpdir do |directory|
      service = Service.new(ApiError.new(403))
      assert_raises(ApiError) { download(service, directory, wait: -> { flunk }) }
      assert_equal 1, service.reads.length
      assert_empty service.downloads
    end
  end

  def test_processing_timeout_stops_without_downloading_an_apk
    Dir.mktmpdir do |directory|
      service = Service.new([group(id: nil)])
      error = assert_raises(ArgumentError) { download(service, directory, wait: -> {}) }
      assert_match(/processing deadline/, error.message)
      assert_equal 3, service.reads.length
      assert_empty service.downloads
    end
  end

  def test_failed_download_removes_partial_file
    Dir.mktmpdir do |directory|
      service = Service.new([group], fail_download: true)
      assert_raises(RuntimeError) { download(service, directory) }
      assert_empty Dir.children(directory)
    end
  end

  def test_invalid_version_and_certificate_fail_before_reading_play
    Dir.mktmpdir do |directory|
      service = Service.new([group])
      assert_raises(ArgumentError) { PlayApk.download(service: service, version: { 'name' => '../bad', 'code' => 32 }, directory: directory, certificate: CERTIFICATE) }
      assert_raises(ArgumentError) { PlayApk.download(service: service, version: VERSION, directory: directory, certificate: 'invalid') }
      assert_empty service.reads
    end
  end
end
