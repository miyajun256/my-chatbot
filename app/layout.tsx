import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "マイチャットボット",
  description: "Next.js + OpenAI API で作るシンプルチャットボット",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link
          href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
          rel="stylesheet"
        />
      </head>
      <body className="h-full w-full">
        <main className="h-full w-full flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
