export default function LegalPage({ type, onBack }) {
  return (
    <div className="legal-page">
      <div className="legal-nav">
        <span className="legal-logo">Echo</span>
        <button className="legal-back-btn" onClick={onBack}>← Back</button>
      </div>

      <div className="legal-content">
        {type === 'tos' ? <TermsOfService /> : <PrivacyPolicy />}
      </div>

      <footer className="landing-footer">
        <span className="landing-footer-logo">Echo</span>
        <span className="landing-footer-copy">© {new Date().getFullYear()} Echo. All rights reserved.</span>
      </footer>
    </div>
  )
}

function TermsOfService() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="legal-date">Last updated: May 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>By creating an account or using Echo ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.</p>

      <h2>2. What Echo Does</h2>
      <p>Echo is an AI-powered meeting intelligence platform. It lets you upload audio or video recordings of meetings, transcribes them using Deepgram, generates AI summaries and answers questions using Anthropic's Claude, and stores the results for your reference.</p>

      <h2>3. Your Account</h2>
      <p>You are responsible for keeping your account credentials secure. You must provide a valid email address and verify it before using the Service. You may not share your account with others.</p>

      <h2>4. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Upload recordings of conversations without the knowledge or consent of all participants where required by law</li>
        <li>Upload illegal, abusive, or harmful content</li>
        <li>Attempt to reverse-engineer, overload, or otherwise abuse the Service</li>
        <li>Use the Service for any unlawful purpose</li>
      </ul>

      <h2>5. Free Plan Limits</h2>
      <p>Free accounts are limited to 5 meetings, audio files up to 100 MB, and recordings up to 2 hours in length. These limits may change with notice.</p>

      <h2>6. Your Content</h2>
      <p>You own the recordings and content you upload. By uploading, you grant Echo a limited licence to process your content solely to provide the Service. We do not use your recordings or transcripts to train AI models.</p>

      <h2>7. Third-Party Services</h2>
      <p>Echo uses third-party services to operate, including Deepgram (transcription), Anthropic (AI), Render (hosting), and Resend (email). Your use of Echo is subject to their respective terms and privacy policies.</p>

      <h2>8. Service Availability</h2>
      <p>We aim to keep Echo available but do not guarantee uninterrupted access. We may modify, suspend, or discontinue the Service at any time with reasonable notice where possible.</p>

      <h2>9. Limitation of Liability</h2>
      <p>Echo is provided "as is" without warranties of any kind. To the fullest extent permitted by law, Echo shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>

      <h2>10. Changes to These Terms</h2>
      <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>

      <h2>11. Contact</h2>
      <p>For any questions about these Terms, contact us at <a href="mailto:jahanzeb2005@gmail.com">jahanzeb2005@gmail.com</a>.</p>
    </>
  )
}

function PrivacyPolicy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="legal-date">Last updated: May 2026</p>

      <h2>1. What We Collect</h2>
      <p>When you use Echo, we collect:</p>
      <ul>
        <li><strong>Account information:</strong> your email address and a hashed (never readable) version of your password</li>
        <li><strong>Meeting content:</strong> audio/video files you upload, transcripts generated from them, AI summaries, chat messages, and any notes you write</li>
        <li><strong>Meeting metadata:</strong> titles, descriptions, dates, and durations</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <p>We use your data exclusively to provide the Service:</p>
      <ul>
        <li>Audio files are sent to Deepgram for transcription</li>
        <li>Transcripts are sent to Anthropic's Claude to generate summaries and answer your questions</li>
        <li>Everything is stored in our database so you can access it later</li>
      </ul>
      <p>We do not sell your data, share it with advertisers, or use it to train AI models.</p>

      <h2>3. Third-Party Processors</h2>
      <p>Your data passes through the following third-party services:</p>
      <ul>
        <li><strong>Deepgram</strong> — audio transcription</li>
        <li><strong>Anthropic</strong> — AI summaries and chat</li>
        <li><strong>Render</strong> — database and file storage hosting</li>
        <li><strong>Resend</strong> — transactional email (verification, password reset)</li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>Your data is retained for as long as your account exists. You can delete individual meetings at any time from within the app. You can also permanently delete your entire account and all associated data from the account settings in the app.</p>

      <h2>5. Security</h2>
      <p>Passwords are hashed using bcrypt and never stored in plain text. All connections use HTTPS. Authentication uses short-lived JWT tokens.</p>

      <h2>6. Your Rights</h2>
      <p>You can delete your meetings at any time from within the app. You may request full account deletion or a copy of your data by emailing us. We will respond within 30 days.</p>

      <h2>7. Cookies</h2>
      <p>Echo does not use tracking cookies. We store your authentication token in your browser's local storage solely to keep you logged in.</p>

      <h2>8. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by email.</p>

      <h2>9. Contact</h2>
      <p>For any privacy questions or requests, contact us at <a href="mailto:jahanzeb2005@gmail.com">jahanzeb2005@gmail.com</a>.</p>
    </>
  )
}
