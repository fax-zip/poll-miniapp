import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "poll",
  description: "Create and vote on polls",
  openGraph: {
    title: "poll",
    description: "Create and vote on polls",
    images: ["https://poll-miniapp-five.vercel.app/image.png"],
  },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: "https://poll-miniapp-five.vercel.app/image.png",
      button: {
        title: "Open Poll",
        action: {
          type: "launch_frame",
          name: "Poll",
          splashBackgroundColor: "#ffffff",
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
