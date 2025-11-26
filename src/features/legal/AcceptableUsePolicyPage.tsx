const AcceptableUsePolicyPage = () => {
  const lastUpdated = "November 25, 2024";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-white mb-2">Acceptable Use Policy</h1>
      <p className="text-slate-400 mb-8">Last updated: {lastUpdated}</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-8">
        {/* Introduction */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">1. About This Tool</h2>
          <p className="text-slate-300 leading-relaxed">
            ScrapeConvert is a client-side utility that runs entirely in your browser. All image downloading
            and processing happens through your own internet connection and device. We do not proxy, store,
            or have access to any content you download.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            As a utility provider, we expect users to use this tool responsibly and in compliance with
            applicable laws.
          </p>
        </section>

        {/* User Responsibility */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">2. User Responsibility</h2>
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-6">
            <p className="text-slate-300 leading-relaxed">
              You are solely responsible for how you use this tool. Before downloading content, ensure you:
            </p>
            <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
              <li>Have the right to download and use the content</li>
              <li>Comply with the target website's terms of service</li>
              <li>Respect copyright and intellectual property rights</li>
              <li>Follow all applicable local and international laws</li>
            </ul>
          </div>
        </section>

        {/* Acceptable Uses */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">3. Acceptable Uses</h2>
          <p className="text-slate-300 leading-relaxed">Examples of acceptable uses include:</p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>Downloading your own images from websites</li>
            <li>Saving images you have permission or license to use</li>
            <li>Downloading public domain or Creative Commons content</li>
            <li>Personal archiving and research (within fair use)</li>
            <li>Converting your own images to different formats</li>
            <li>Managing your company's own image assets</li>
          </ul>
        </section>

        {/* Prohibited Uses */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">4. Prohibited Uses</h2>
          <p className="text-slate-300 leading-relaxed">
            Do not use this tool for:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>Downloading copyrighted content without authorization</li>
            <li>Bypassing paywalls or access controls</li>
            <li>Any illegal activity</li>
            <li>Violating others' intellectual property rights</li>
            <li>Conducting attacks on websites or servers</li>
          </ul>
        </section>

        {/* Disclaimer */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">5. Disclaimer</h2>
          <div className="bg-surface/50 border border-white/10 rounded-lg p-6">
            <p className="text-slate-300 leading-relaxed">
              ScrapeConvert, operated by Visser Analytics, is a neutral utility tool. Since all operations
              occur client-side through your browser and internet connection, we have no visibility into
              or control over what content you access or download.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              <strong className="text-white">We are not liable for:</strong>
            </p>
            <ul className="list-disc list-inside text-slate-300 mt-2 space-y-2">
              <li>Content you choose to download</li>
              <li>How you use downloaded content</li>
              <li>Any copyright or legal issues arising from your use</li>
              <li>Your compliance with third-party terms of service</li>
            </ul>
            <p className="text-slate-300 leading-relaxed mt-4">
              You assume full responsibility for your use of this tool.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">6. Contact</h2>
          <p className="text-slate-300 leading-relaxed">
            Questions about this policy? Contact us at{" "}
            <a href="mailto:support@visseranalytics.com" className="text-primary hover:text-primary/80">
              support@visseranalytics.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default AcceptableUsePolicyPage;
