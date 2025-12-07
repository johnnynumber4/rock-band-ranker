import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rock Band Ranked Choice Voting",
  description: "Rerank the greatest rock bands of all time using ranked choice voting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
