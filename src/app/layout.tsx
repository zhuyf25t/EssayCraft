import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EssayCraft MVP",
  description: "AI-assisted academic essay workflow editor."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
