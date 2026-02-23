import type { Metadata } from "next";
import { SdkPlaygroundTool } from "@/components/tools/sdk-playground-tool";

export const metadata: Metadata = {
  title: "A2A SDK Playground — StackA2A",
  description:
    "Generate connection code for any A2A agent in Python, TypeScript, Java, Go, or C#. Customize the URL and message, then copy the snippet.",
  alternates: {
    canonical: "https://stacka2a.dev/tools/sdk-playground",
  },
};

export default function SdkPlaygroundPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary">
        SDK Playground
      </h1>
      <p className="mt-2 text-text-secondary">
        Generate connection code for any A2A agent. Enter the agent URL and
        message, pick your SDK, and get a ready-to-run snippet.
      </p>

      <div className="mt-8">
        <SdkPlaygroundTool />
      </div>
    </div>
  );
}
