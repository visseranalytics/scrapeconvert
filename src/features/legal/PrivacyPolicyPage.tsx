const PrivacyPolicyPage = () => {
  const lastUpdated = "November 25, 2024";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-slate-400 mb-8">Last updated: {lastUpdated}</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-8">
        {/* Introduction */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
          <p className="text-slate-300 leading-relaxed">
            Visser Analytics ("we," "us," or "our") operates ScrapeConvert and respects your privacy. This policy
            describes the types of information we may collect from you or that you may provide when you use our
            website at scrapeconvert.com (the "Service") and our practices for collecting, using, maintaining,
            protecting, and disclosing that information.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            By using our Service, you agree to the collection and use of information in accordance with this Privacy Policy.
          </p>
        </section>

        {/* Privacy-First Design */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">2. Our Privacy-First Approach</h2>
          <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-6">
            <p className="text-slate-300 leading-relaxed">
              <strong className="text-white">ScrapeConvert is designed with privacy as a core principle.</strong> Our
              image scraping and conversion tools operate entirely within your browser (client-side). This means:
            </p>
            <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
              <li>Images you scrape are <strong className="text-white">never uploaded</strong> to our servers</li>
              <li>Image conversions happen <strong className="text-white">locally</strong> on your device</li>
              <li>We have <strong className="text-white">no access</strong> to the content you process</li>
              <li>Your files <strong className="text-white">never leave</strong> your browser</li>
              <li>We do <strong className="text-white">not store</strong> your scraped images or conversion history</li>
            </ul>
          </div>
        </section>

        {/* Information We Collect */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">3. Information We Collect</h2>

          <h3 className="text-xl font-medium text-white mt-6 mb-3">3.1 Information We Do NOT Collect</h3>
          <p className="text-slate-300 leading-relaxed">
            Given our client-side architecture, we explicitly do not collect:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>URLs you enter for scraping</li>
            <li>Images you download or convert</li>
            <li>Personal files or documents</li>
            <li>User accounts or login credentials (we don't have accounts)</li>
            <li>Payment information (our Service is free)</li>
            <li>Personal identification information</li>
          </ul>

          <h3 className="text-xl font-medium text-white mt-6 mb-3">3.2 Automatically Collected Information</h3>
          <p className="text-slate-300 leading-relaxed">
            When you access our Service, we may automatically collect certain information through analytics services:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>
              <strong className="text-white">Usage Data:</strong> Pages visited, time spent on pages, clicks, and
              navigation patterns
            </li>
            <li>
              <strong className="text-white">Device Information:</strong> Browser type, operating system, device type,
              and screen resolution
            </li>
            <li>
              <strong className="text-white">Referral Data:</strong> The website that referred you to our Service
            </li>
            <li>
              <strong className="text-white">Geographic Region:</strong> General geographic location based on IP address
              (country/region level, not precise location)
            </li>
          </ul>
          <p className="text-slate-300 leading-relaxed mt-4">
            This information is collected in aggregate form and cannot be used to personally identify you.
          </p>
        </section>

        {/* How We Use Information */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">4. How We Use Collected Information</h2>
          <p className="text-slate-300 leading-relaxed">
            The limited information we collect is used solely for:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>Understanding how users interact with our Service to improve user experience</li>
            <li>Identifying and fixing technical issues or bugs</li>
            <li>Analyzing usage patterns to prioritize new features</li>
            <li>Monitoring the performance and reliability of our Service</li>
            <li>Preventing abuse or malicious use of our Service</li>
          </ul>
          <p className="text-slate-300 leading-relaxed mt-4">
            We do not sell, rent, or share your personal information with third parties for marketing purposes.
          </p>
        </section>

        {/* Third-Party Services */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">5. Third-Party Services</h2>
          <p className="text-slate-300 leading-relaxed">
            Our Service uses the following third-party services:
          </p>

          <h3 className="text-xl font-medium text-white mt-6 mb-3">5.1 Vercel Analytics</h3>
          <p className="text-slate-300 leading-relaxed">
            We use Vercel Analytics to collect anonymous usage statistics. Vercel Analytics is privacy-focused and:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>Does not use cookies for tracking</li>
            <li>Does not collect personal information</li>
            <li>Complies with GDPR, CCPA, and other privacy regulations</li>
            <li>Provides only aggregate, anonymized data</li>
          </ul>
          <p className="text-slate-300 leading-relaxed mt-4">
            For more information, see{" "}
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline"
            >
              Vercel's Privacy Policy
            </a>.
          </p>

          <h3 className="text-xl font-medium text-white mt-6 mb-3">5.2 Google Fonts</h3>
          <p className="text-slate-300 leading-relaxed">
            We use Google Fonts to display typography on our website. When you load our pages, your browser may connect
            to Google's servers to download font files. Google may collect:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>Your IP address</li>
            <li>The URL of the page you visited</li>
            <li>Browser and device information</li>
          </ul>
          <p className="text-slate-300 leading-relaxed mt-4">
            For more information, see{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline"
            >
              Google's Privacy Policy
            </a>.
          </p>

          <h3 className="text-xl font-medium text-white mt-6 mb-3">5.3 Content Delivery and Hosting</h3>
          <p className="text-slate-300 leading-relaxed">
            Our Service is hosted on Vercel's infrastructure. Vercel may collect standard server logs including IP
            addresses, timestamps, and requested URLs for security and operational purposes.
          </p>
        </section>

        {/* Cookies */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">6. Cookies and Local Storage</h2>
          <p className="text-slate-300 leading-relaxed">
            <strong className="text-white">Cookies:</strong> Our Service does not use cookies for tracking or advertising
            purposes. Essential cookies may be used for basic functionality.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            <strong className="text-white">Local Storage:</strong> Our Service may use your browser's local storage to
            temporarily store settings or preferences. This data remains on your device and is not transmitted to our servers.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            You can control cookies and local storage through your browser settings. Note that disabling these features
            may affect the functionality of our Service.
          </p>
        </section>

        {/* Data Security */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">7. Data Security</h2>
          <p className="text-slate-300 leading-relaxed">
            We implement appropriate technical and organizational security measures to protect the limited data we collect:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
            <li>All connections to our Service use HTTPS encryption</li>
            <li>Our infrastructure is hosted on secure, enterprise-grade platforms</li>
            <li>We regularly review and update our security practices</li>
          </ul>
          <p className="text-slate-300 leading-relaxed mt-4">
            However, no method of transmission over the Internet or method of electronic storage is 100% secure. While
            we strive to use commercially acceptable means to protect your information, we cannot guarantee its absolute security.
          </p>
        </section>

        {/* Data Retention */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">8. Data Retention</h2>
          <p className="text-slate-300 leading-relaxed">
            Since our core functionality is client-side, we do not retain any user content (images, URLs, etc.).
            Analytics data is retained in accordance with our analytics provider's policies and is used only in
            aggregate form.
          </p>
        </section>

        {/* Children's Privacy */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">9. Children's Privacy</h2>
          <p className="text-slate-300 leading-relaxed">
            Our Service is not intended for children under the age of 13 (or 16 in the European Economic Area). We do
            not knowingly collect personal information from children. If you are a parent or guardian and believe your
            child has provided us with personal information, please contact us so we can take appropriate action.
          </p>
        </section>

        {/* International Users */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">10. International Users</h2>
          <p className="text-slate-300 leading-relaxed">
            Our Service is operated from the United States. If you are accessing our Service from outside the United
            States, please be aware that information may be transferred to, stored, and processed in the United States
            or other countries where our service providers operate.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            By using our Service, you consent to the transfer of information to countries outside your country of
            residence, which may have different data protection rules than your country.
          </p>
        </section>

        {/* Your Rights */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">11. Your Privacy Rights</h2>
          <p className="text-slate-300 leading-relaxed">
            Depending on your location, you may have certain rights regarding your personal information:
          </p>

          <h3 className="text-xl font-medium text-white mt-6 mb-3">For European Users (GDPR)</h3>
          <ul className="list-disc list-inside text-slate-300 space-y-2">
            <li>Right to access your personal data</li>
            <li>Right to rectification of inaccurate data</li>
            <li>Right to erasure ("right to be forgotten")</li>
            <li>Right to restrict processing</li>
            <li>Right to data portability</li>
            <li>Right to object to processing</li>
          </ul>

          <h3 className="text-xl font-medium text-white mt-6 mb-3">For California Residents (CCPA)</h3>
          <ul className="list-disc list-inside text-slate-300 space-y-2">
            <li>Right to know what personal information is collected</li>
            <li>Right to know if personal information is sold or disclosed</li>
            <li>Right to say no to the sale of personal information</li>
            <li>Right to access your personal information</li>
            <li>Right to equal service and price</li>
          </ul>

          <p className="text-slate-300 leading-relaxed mt-4">
            Since we collect minimal data and do not maintain user accounts, most of these rights may not be applicable.
            However, if you wish to exercise any of these rights, please contact us using the information below.
          </p>
        </section>

        {/* Do Not Track */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">12. Do Not Track Signals</h2>
          <p className="text-slate-300 leading-relaxed">
            Some browsers have a "Do Not Track" (DNT) feature that sends a signal to websites requesting that they
            not track your browsing activity. Our Service respects DNT signals, and we do not track users across
            third-party websites.
          </p>
        </section>

        {/* Changes to Policy */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">13. Changes to This Privacy Policy</h2>
          <p className="text-slate-300 leading-relaxed">
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new
            Privacy Policy on this page and updating the "Last updated" date at the top.
          </p>
          <p className="text-slate-300 leading-relaxed mt-4">
            You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy
            are effective when they are posted on this page.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">14. Contact Us</h2>
          <p className="text-slate-300 leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:support@visseranalytics.com" className="text-primary hover:text-primary/80">
              support@visseranalytics.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
