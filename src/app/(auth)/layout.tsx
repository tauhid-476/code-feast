export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="label">Code Feast</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            One contest. One clock.
          </h1>
        </div>
        {children}
      </div>
    </main>
  );
}
