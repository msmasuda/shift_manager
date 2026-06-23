import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user?.role === "ADMIN") redirect("/admin");
  if (session?.user) redirect("/my-shifts");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      
      {/* Hero Section */}
      <div className="mb-12 max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent to-purple-500">
            Shift Management
          </span>
          <br />
          <span className="text-foreground">Made Beautiful.</span>
        </h1>
        <p className="text-lg text-textMuted max-w-xl mx-auto">
          モダンで洗練されたバイト・アルバイトのシフト管理プラットフォーム。
          スマートフォンやPCから、いつでもどこでも確認・管理が可能です。
        </p>
      </div>

      {/* Feature Cards Section */}
      <section className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        <a href="/my-shifts" className="group">
          <div className="glass-card interactive-element p-8 h-full flex flex-col items-start text-left border-transparent hover:border-accent/40 bg-surface/50 hover:bg-surface/80">
            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-6 group-hover:bg-accent/40 transition-colors">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-foreground group-hover:text-accent transition-colors">
              自分のシフト
            </h2>
            <p className="text-textMuted leading-relaxed">
              PC・スマートフォンから、自身のシフト割り当てをすばやく確認・管理できます。
            </p>
          </div>
        </a>

        <a href="/admin" className="group">
          <div className="glass-card interactive-element p-8 h-full flex flex-col items-start text-left border-transparent hover:border-purple-500/40 bg-surface/50 hover:bg-surface/80">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6 group-hover:bg-purple-500/40 transition-colors">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-foreground group-hover:text-purple-400 transition-colors">
              管理者用パネル
            </h2>
            <p className="text-textMuted leading-relaxed">
              シフトの作成・編集、直感的なドラッグ移動、必要人数の設定や警告チェックを一元管理します。
            </p>
          </div>
        </a>
      </section>
      
    </div>
  );
}
