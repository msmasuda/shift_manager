export default function Home() {
  return (
    <div style={{ maxWidth: "40rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>シフト管理</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        バイト・アルバイトのシフトを管理し、自分のシフトを確認できるアプリです。
      </p>
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <a
          href="/my-shifts"
          style={{
            display: "block",
            padding: "1rem 1.25rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <strong>自分のシフト</strong>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            PC・スマートフォンで自分のシフトを確認
          </p>
        </a>
        <a
          href="/admin"
          style={{
            display: "block",
            padding: "1rem 1.25rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <strong>管理者</strong>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            シフトの作成・編集、ドラッグで移動、最低人数の設定と警告
          </p>
        </a>
      </section>
    </div>
  );
}
