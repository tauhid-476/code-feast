import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function Unauthorized() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="label">401 · Sign in required</p>
          <h1 className="text-xl font-semibold">You are not signed in</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with the account the organizer knows you by.
          </p>
          <Button className="mt-3" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </CardBody>
      </Card>
    </main>
  );
}
