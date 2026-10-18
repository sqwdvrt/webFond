import styles from "../admin.module.css";

export default function AdminLoading() {
  return (
    <div className={styles.adminLoading}>
      <section
        aria-busy="true"
        aria-labelledby="admin-loading-title"
        className={styles.adminLoadingContent}
      >
        <h1 id="admin-loading-title">Административная часть</h1>
        <div aria-hidden="true" className={styles.adminLoadingBlocks}>
          <span />
          <span />
          <span />
        </div>
      </section>
      <p className={styles.adminLoadingStatus} role="status">
        Загрузка данных…
      </p>
    </div>
  );
}
