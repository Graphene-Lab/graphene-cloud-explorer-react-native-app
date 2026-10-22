require 'json'
require 'fileutils'
require_relative '../fastlane/release_config'

module PlayApk
  def self.fingerprint(value)
    result = value.to_s.delete(':').downcase
    raise ArgumentError, 'Invalid Play signing certificate SHA-256 fingerprint.' unless result.match?(/\A[0-9a-f]{64}\z/)

    result
  end

  def self.download(service:, version:, directory:, certificate:, attempts: 41, wait: -> { sleep 15 })
    code = version.fetch('code')
    name = version.fetch('name')
    unless code.is_a?(Integer) && code.between?(1, 2_100_000_000) && name.match?(/\A\d+\.\d+\.\d+\z/)
      raise ArgumentError, 'Invalid validated release version.'
    end
    expected = fingerprint(certificate)
    selected = nil
    attempts.times do |attempt|
      begin
        groups = service.list_generatedapks(PlayRelease::PACKAGE_NAME, code).generated_apks || []
        matching = groups.select { |group| fingerprint(group.certificate_sha256_hash) == expected }
        raise ArgumentError, 'Play returned duplicate matching signing certificates.' if matching.length > 1

        if groups.any? && matching.empty?
          raise ArgumentError, 'Play APK signing certificates do not match the configured Play app signing fingerprint.'
        end
        selected = matching.first&.generated_universal_apk&.download_id
        break unless selected.to_s.empty?
      rescue StandardError => error
        status = error.respond_to?(:status_code) ? error.status_code.to_i : nil
        raise unless [404, 429, 500, 502, 503, 504].include?(status)
      end
      if attempt < attempts - 1
        puts "Waiting for Play to generate the signed universal APK (versionCode #{code}, attempt #{attempt + 1}/#{attempts})."
        wait.call
      end
    end
    raise ArgumentError, 'Play has no matching universal APK yet. Retry action=attach with the existing release tag; no rebuild or new Play upload is needed.' if selected.to_s.empty?

    FileUtils.mkdir_p(directory)
    filename = File.join(directory, "Graphene-Cloud-Explorer-#{name}.apk")
    partial = "#{filename}.part"
    begin
      File.open(partial, 'wb') do |file|
        service.download_generatedapk(PlayRelease::PACKAGE_NAME, code, selected, download_dest: file)
      end
      raise ArgumentError, 'Play returned an empty APK.' unless File.size?(partial)

      File.rename(partial, filename)
    ensure
      File.delete(partial) if File.exist?(partial)
    end
    puts "Downloaded Play-signed universal APK for #{name} (#{code})."
    filename
  end
end

if $PROGRAM_NAME == __FILE__
  begin
    require 'google/apis/androidpublisher_v3'
    require 'googleauth'
    service = Google::Apis::AndroidpublisherV3::AndroidPublisherService.new
    service.authorization = Google::Auth.get_application_default(['https://www.googleapis.com/auth/androidpublisher'])
    service.client_options.open_timeout_sec = 30
    service.client_options.read_timeout_sec = 120
    version = JSON.parse(File.read(File.join(ENV.fetch('RUNNER_TEMP'), 'play-apk-release.json')))
    PlayApk.download(
      service: service, version: version,
      directory: File.join(ENV.fetch('RUNNER_TEMP'), 'play-release-apk'),
      certificate: ENV.fetch('PLAY_APP_SIGNING_SHA256')
    )
  rescue StandardError => error
    # Do not print SDK errors: their request URLs or response bodies may contain credentials.
    warn(error.is_a?(ArgumentError) ? error.message : "Play APK download failed (#{error.class.name.split('::').last}). Check API access and retry action=attach.")
    exit 1
  end
end
