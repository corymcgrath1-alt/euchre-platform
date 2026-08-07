import type { Metadata } from "next";
import styles from "../legal-page.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy information for the offline Euchre Club solo game."
};

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.content}>
        <p className={styles.eyebrow}>Effective August 7, 2026</p>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.lede}>
          Euchre Club version 1.0 is designed as an offline solo card game. Its game logic,
          saved games, settings, history, and reviews run on and remain on your device during
          normal play.
        </p>

        <section className={styles.section}>
          <h2>Data stored on your device</h2>
          <p>
            The app stores solo game records, ordered move events, active-game recovery data,
            completed-game history, practice seeds, game reviews, and app settings in local
            application storage. This data is used to play, resume, and review games.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Accounts, analytics, advertising, and tracking</h2>
          <p>
            The current mobile app does not provide accounts or sign-in and does not include
            analytics, advertising, cross-app tracking, or advertising identifiers. The release
            dependency audit must be repeated before each App Store submission because bundled
            software can change.
          </p>
        </section>

        <section className={styles.section}>
          <h2>When information can leave the device</h2>
          <p>
            Core gameplay does not require a network connection. If you choose Share Result,
            iOS opens its native share sheet and you choose the destination. Opening an external
            privacy or support link may send a normal web request to the selected site. A hosting
            provider may process standard request metadata such as an IP address according to its
            own policies.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Deleting local data</h2>
          <p>
            Reset Local Data in the app removes saved games and settings after confirmation.
            Removing the app also removes its application-container data according to iOS behavior.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Permissions and device access</h2>
          <p>
            Version 1.0 does not request access to location, contacts, camera, microphone, photos,
            Bluetooth, notifications, or advertising identifiers. It uses app lifecycle events,
            optional haptics, status-bar and launch-screen integration, and the native share sheet.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Contact</h2>
          <p>
            Questions about this policy or the app can be submitted through the public Euchre Club
            support page. Do not include private device information in a support request.
          </p>
          <a className={styles.action} href="https://corymcgrath1-alt.github.io/euchre-platform/support/">
            Open Euchre Club Support
          </a>
        </section>
      </article>
    </main>
  );
}
