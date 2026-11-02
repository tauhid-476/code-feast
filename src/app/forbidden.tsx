import Link from "next/link";
import { Button } from "@/components/legacy-ui/button";
import { Card, CardContent } from "@/components/legacy-ui/card";

export default function Forbidden() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="label">403 · Refused</p>
          <h1 className="text-xl font-semibold">Not available to this account</h1>
          <p className="text-sm text-muted-foreground">
            Organizers run events from the admin side and cannot join one.
            Participants enter with a join code.
          </p>
          <Button className="mt-3" render={<Link href="/" />}>
            Go to your landing page
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
