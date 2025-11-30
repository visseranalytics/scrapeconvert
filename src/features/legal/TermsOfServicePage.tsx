const TermsOfServicePage = () => {
  const lastUpdated = "November 28, 2024";

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
            <li>Convert images between various formats (JPEG, PNG, WebP)</li>
            <li>Optimize and compress images for web use</li>
          </ul>
          <p className="text-slate-300 leading-relaxed mt-4">
            All processing occurs entirely in your browser using your internet connection.
            We do not proxy requests, store images, or have access to the content you process.
          </p>
        </section>

        {/* Content Filtering */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">3. Content Filtering & Limitations</h2>
          <p className="text-slate-300 leading-relaxed">
            To promote ethical use, the Service includes automatic filtering that blocks images from
            known paid stock photo providers, including but not limited to:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>Adobe Stock, iStock, Getty Images</li>
            <li>Shutterstock, Depositphotos, 123RF</li>
            <li>Dreamstime, Alamy, Bigstock</li>
            <li>Other commercial stock photography services</li>
          </ul>
          <p className="text-slate-300 leading-relaxed mt-4">
            <strong className="text-white">Important:</strong> This filtering is provided as a convenience only
            and is not comprehensive. It does not guarantee that all protected content is blocked, nor does it
            verify licensing status of any image. You remain solely responsible for ensuring you have
            the legal right to download and use any content.
          </p>
        </section>

        {/* User Responsibilities */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">4. User Responsibilities</h2>
          <p className="text-slate-300 leading-relaxed">By using the Service, you agree that:</p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>You are solely responsible for verifying you have the legal right to download and use any content</li>
            <li>You will respect copyright, trademark, and other intellectual property rights</li>
            <li>You will comply with the terms of service of websites you access</li>
            <li>You will comply with all applicable laws and regulations, including copyright law</li>
            <li>You will not use the Service to infringe on any third-party rights</li>
            <li>You will not attempt to circumvent or bypass any content filtering measures</li>
            <li>You will not use the Service for any illegal, fraudulent, or harmful purpose</li>
          </ul>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mt-4">
            <p className="text-amber-200 text-sm">
              <strong>Note:</strong> "Free to view" does not mean "free to use." Many images on the internet
              are protected by copyright even if they appear accessible. Always verify licensing before using
              any downloaded content, especially for commercial purposes.
            </p>
          </div>
        </section>

        {/* Intellectual Property */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">5. Intellectual Property</h2>
          <p className="text-slate-300 leading-relaxed">
            The Service itself (code, design, branding) is owned by Visser Analytics and protected by
            applicable intellectual property laws.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            Content you download through the Service belongs to its respective owners. The Service does not
            grant you any license or rights to third-party content. You must independently verify licensing
            and obtain proper permissions before using any downloaded content.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            Common sources of freely-licensed images include Creative Commons repositories, public domain
            archives, and websites that explicitly offer free-to-use content. Always check the specific
            license terms for each image.
          </p>
        </section>

        {/* No Endorsement */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">6. No Endorsement of Downloaded Content</h2>
          <p className="text-slate-300 leading-relaxed">
            The Service is a neutral tool. By providing the ability to download images, we do not:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>Endorse, verify, or guarantee the licensing status of any content</li>
            <li>Represent that any content is free to use</li>
            <li>Provide legal advice regarding copyright or fair use</li>
            <li>Accept responsibility for how you use downloaded content</li>
          </ul>
        </section>

        {/* Disclaimers */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">7. Disclaimers</h2>
          <div className="bg-surface/50 border border-white/10 rounded-lg p-6">
            <p className="text-slate-300 leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR
              THAT ANY CONTENT FILTERING WILL BE COMPLETE OR ACCURATE.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              WE MAKE NO REPRESENTATIONS OR WARRANTIES REGARDING THE LEGALITY, LICENSING STATUS, OR
              OWNERSHIP OF ANY CONTENT YOU ACCESS THROUGH THE SERVICE. THE CONTENT FILTERING FEATURE
              IS PROVIDED AS A CONVENIENCE ONLY AND SHOULD NOT BE RELIED UPON AS LEGAL PROTECTION.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              YOU USE THE SERVICE ENTIRELY AT YOUR OWN RISK.
            </p>
          </div>
        </section>

        {/* Limitation of Liability */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
          <div className="bg-surface/50 border border-white/10 rounded-lg p-6">
            <p className="text-slate-300 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, VISSER ANALYTICS AND ITS OFFICERS, DIRECTORS,
              EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              WE ARE NOT LIABLE FOR:
            </p>
            <ul className="list-disc list-inside text-slate-300 mt-2 space-y-2">
              <li>Content you download, process, or use in any way</li>
              <li>Copyright infringement claims or legal action against you</li>
              <li>Your violation of third-party intellectual property rights</li>
              <li>Your violation of any website's terms of service</li>
              <li>Failure of content filtering to block protected content</li>
              <li>Any damages resulting from your use or inability to use the Service</li>
              <li>Loss of data, profits, or business opportunities</li>
            </ul>
          </div>
        </section>

        {/* Indemnification */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">9. Indemnification</h2>
          <p className="text-slate-300 leading-relaxed">
            You agree to indemnify, defend, and hold harmless Visser Analytics and its officers, directors,
            employees, agents, and affiliates from and against any and all claims, damages, losses, costs,
            and expenses (including reasonable attorneys' fees) arising from:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any third-party rights, including intellectual property rights</li>
            <li>Any content you download, process, or distribute using the Service</li>
            <li>Any claim that your use of downloaded content infringes on third-party rights</li>
          </ul>
        </section>

        {/* DMCA */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">10. Copyright Complaints</h2>
          <p className="text-slate-300 leading-relaxed">
            If you are a copyright owner and believe that content accessible through our Service infringes
            your copyright, please note that ScrapeConvert does not host, store, or control any third-party
            content. We are a client-side tool that processes publicly available web content.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            To request that a domain be added to our blocked list, or to report concerns about the Service,
            please contact us at{" "}
            <a href="mailto:legal@visseranalytics.com" className="text-primary hover:text-primary/80">
              legal@visseranalytics.com
            </a>
          </p>
        </section>

        {/* Modifications */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">11. Modifications</h2>
          <p className="text-slate-300 leading-relaxed">
            We may modify these Terms at any time. Changes are effective immediately when posted.
            Your continued use of the Service after any modifications constitutes acceptance of the
            updated Terms. We encourage you to review these Terms periodically.
          </p>
        </section>

        {/* Termination */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">12. Termination</h2>
          <p className="text-slate-300 leading-relaxed">
            We may terminate or suspend access to the Service at any time, without prior notice or
            liability, for any reason, including if you breach these Terms.
          </p>
        </section>

        {/* Governing Law */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">13. Governing Law</h2>
          <p className="text-slate-300 leading-relaxed">
            These Terms shall be governed by and construed in accordance with applicable law, without
            regard to conflict of law principles. Any disputes arising from these Terms or the Service
            shall be resolved in the appropriate courts of competent jurisdiction.
          </p>
        </section>

        {/* Severability */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">14. Severability</h2>
          <p className="text-slate-300 leading-relaxed">
            If any provision of these Terms is found to be unenforceable or invalid, that provision
            shall be limited or eliminated to the minimum extent necessary, and the remaining provisions
            shall remain in full force and effect.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">15. Contact</h2>
          <p className="text-slate-300 leading-relaxed">
            Questions about these Terms? Contact us at{" "}
            <a href="mailto:support@visseranalytics.com" className="text-primary hover:text-primary/80">
              support@visseranalytics.com
            </a>
          </p>
          <p className="text-slate-300 leading-relaxed mt-2">
            For legal inquiries or copyright concerns:{" "}
            <a href="mailto:legal@visseranalytics.com" className="text-primary hover:text-primary/80">
              legal@visseranalytics.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
