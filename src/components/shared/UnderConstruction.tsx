import { Construction } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";

interface UnderConstructionProps {
  title?: string;
  description?: string;
  backLink?: string;
  backText?: string;
}

export function UnderConstruction({
  title = "Under Construction",
  description = "This page is currently under development. Please check back later.",
  backLink = "/",
  backText = "Go back to home page",
}: UnderConstructionProps) {
  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Construction className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href={backLink}>{backText}</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
