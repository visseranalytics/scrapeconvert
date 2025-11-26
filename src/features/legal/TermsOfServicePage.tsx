const TermsOfServicePage = () => {
  const lastUpdated = "November 25, 2024";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-slate-400 mb-8">Last updated: {lastUpdated}</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-8">
        {/* Acceptance */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
          <p className="text-slate-300 leading-relaxed">
            By using ScrapeConvert ("Service"), operated by Visser Analytics, you agree to these Terms of Service,
            our Privacy Policy, and our Acceptable Use Policy. If you do not agree, do not use the Service.
          </p>
        </section>

        {/* Description */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
          <p className="text-slate-300 leading-relaxed">
            ScrapeConvert is a client-side web utility that allows you to:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>Extract images from publicly accessible websites</li>
            <li>Convert images between various formats</li>
          </ul>
          <p className="text-slate-300 leading-relaxed mt-4">
            All processing occurs entirely in your browser using your internet connection.
            We do not proxy requests, store images, or have access to the content you download.
          </p>
        </section>

        {/* User Responsibilities */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">3. User Responsibilities</h2>
          <p className="text-slate-300 leading-relaxed">By using the Service, you agree that:</p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>You are responsible for ensuring you have the right to download any content</li>
            <li>You will respect copyright and intellectual property rights</li>
            <li>You will comply with the terms of service of websites you access</li>
            <li>You will comply with all applicable laws and regulations</li>
            <li>You will not use the Service for any illegal purpose</li>
          </ul>
        </section>

        {/* Intellectual Property */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">4. Intellectual Property</h2>
          <p className="text-slate-300 leading-relaxed">
            The Service itself (code, design, branding) is owned by Visser Analytics.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            Content you download through the Service belongs to its respective owners. We do not grant
            you any rights to third-party content. You must independently verify you have the right
            to use any content you download.
          </p>
        </section>

        {/* Disclaimers */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">5. Disclaimers</h2>
          <div className="bg-surface/50 border border-white/10 rounded-lg p-6">
            <p className="text-slate-300 leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT
              THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              WE MAKE NO REPRESENTATIONS REGARDING THE LEGALITY OF DOWNLOADING ANY PARTICULAR CONTENT.
              YOU USE THE SERVICE AT YOUR OWN RISK.
            </p>
          </div>
        </section>

        {/* Limitation of Liability */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">6. Limitation of Liability</h2>
          <div className="bg-surface/50 border border-white/10 rounded-lg p-6">
            <p className="text-slate-300 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, VISSER ANALYTICS SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR
              USE OF THE SERVICE.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              WE ARE NOT LIABLE FOR:
            </p>
            <ul className="list-disc list-inside text-slate-300 mt-2 space-y-2">
              <li>Content you download or how you use it</li>
              <li>Copyright claims or legal action against you</li>
              <li>Your violation of third-party rights or terms of service</li>
              <li>Any damages resulting from your use or inability to use the Service</li>
            </ul>
          </div>
        </section>

        {/* Indemnification */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">7. Indemnification</h2>
          <p className="text-slate-300 leading-relaxed">
            You agree to indemnify and hold harmless Visser Analytics from any claims, damages, or expenses
            arising from your use of the Service, your violation of these Terms, or your violation of
            any third-party rights.
          </p>
        </section>

        {/* Modifications */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">8. Modifications</h2>
          <p className="text-slate-300 leading-relaxed">
            We may modify these Terms at any time. Changes are effective when posted. Your continued
            use of the Service constitutes acceptance of the modified Terms.
          </p>
        </section>

        {/* Termination */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">9. Termination</h2>
          <p className="text-slate-300 leading-relaxed">
            We may terminate or suspend access to the Service at any time, without notice, for any reason.
          </p>
        </section>

        {/* Governing Law */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">10. Governing Law</h2>
          <p className="text-slate-300 leading-relaxed">
            These Terms are governed by applicable law. Any disputes shall be resolved in the
            appropriate courts of competent jurisdiction.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">11. Contact</h2>
          <p className="text-slate-300 leading-relaxed">
            Questions about these Terms? Contact us at{" "}
            <a href="mailto:support@visseranalytics.com" className="text-primary hover:text-primary/80">
              support@visseranalytics.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
