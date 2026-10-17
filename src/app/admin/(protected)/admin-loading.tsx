import styles from "../admin.module.css";

export default function AdminLoading() {
  return (
    <section
      aria-busy="true"
      aria-labelledby="admin-loading-title"
      className={styles.adminLoading}
      role="status"
    >
      <h1 id="admin-loading-title">Загрузка данных</h1>
      <p>Загрузка данных…</p>
      <div aria-hidden="true" className={styles.adminLoadingBlocks}>
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
