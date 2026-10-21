import type { Metadata } from "next";
import { Noto_Sans_Thai, Source_Sans_3 } from "next/font/google";
import { AppProviders } from "@/components/language";
import "./globals.css";

const source = Source_Sans_3({ subsets: ["latin"], variable: "--font-source" });
const thai = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "600", "700"], variable: "--font-thai" });

export const metadata: Metadata = {
  title: { default: "SmartDLT2.0", template: "%s · SmartDLT2.0" },
  description: "SmartDLT2.0 is a demonstration appointment desk for training and testing. Not an official DLT service.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${source.variable} ${thai.variable} h-full`}>
      <body className="min-h-full bg-paper text-ink antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
