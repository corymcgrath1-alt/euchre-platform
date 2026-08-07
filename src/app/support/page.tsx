import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import styles from "../legal-page.module.css";

export const metadata: Metadata = {
  title: "Support",
  description: "Support information for the Euchre Club solo game."
};

export default function SupportPage() {
  return (
    <main className={styles.page}>
      <article className={styles.content}>
        <p className={styles.eyebrow}>Euchre Club 1.0</p>
        <h1 className={styles.title}>Support</h1>
        <p className={styles.lede}>
          Euchre Club is an offline solo game. Most play, save, resume, and review problems
          can be diagnosed without sharing device identifiers or private device information.
        </p>

        <section className={styles.section}>
          <h2>Include with a support request</h2>
          <ul>
            <li>App version and build number from Settings.</li>
            <li>Practice seed, if the game used one.</li>
            <li>The phase shown on the table and the action you attempted.</li>
            <li>Whether the app had just resumed after being backgrounded.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Local recovery</h2>
          <p>
            Return Home and choose Resume Game to reload the active game from its append-only
            move history. Reset Local Data is destructive and should be used only after other
            recovery steps because it removes local games and settings.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Contact</h2>
          <p>
            Open a public support request in the Euchre Club repository. Include only the game
            details listed above and do not post private device or account information.
          </p>
          <a
            className={styles.action}
            href="https://github.com/corymcgrath1-alt/euchre-platform/issues/new?template=euchre-support.yml"
          >
            Open a Support Request
          </a>
          <Link className={styles.action} href={"/privacy" as Route}>
            Read the Privacy Policy
          </Link>
        </section>
      </article>
    </main>
  );
}
