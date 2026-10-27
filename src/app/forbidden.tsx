import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Forbidden() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="label">403 · Refused</p>
          <h1 className="text-xl font-semibold">Not your surface</h1>
          <p className="text-sm text-muted-foreground">
            This account is not an organizer. Nothing here is available to you.
          </p>
          <Button className="mt-3" render={<Link href="/" />}>
            Go to your landing page
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
