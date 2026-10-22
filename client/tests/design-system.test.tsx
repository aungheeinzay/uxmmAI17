import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

describe("design system tokens", () => {
  it("keeps typography scale utilities alongside text colors", () => {
    expect(cn("text-heading-2 text-foreground")).toBe("text-heading-2 text-foreground");
    expect(cn("text-body-md text-muted-foreground")).toBe("text-body-md text-muted-foreground");
    expect(cn("text-caption text-muted-foreground")).toBe("text-caption text-muted-foreground");
  });

  it("resolves conflicting font sizes to the last one", () => {
    expect(cn("text-heading-2 text-body-md")).toBe("text-body-md");
  });

  it("resolves conflicting surface colors to the last one", () => {
    expect(cn("bg-card", "bg-brand-tint")).toBe("bg-brand-tint");
    expect(cn("border-border", "border-brand/25")).toBe("border-brand/25");
  });
});

describe("ui primitives", () => {
  it("renders badges with status tone classes", () => {
    render(<Badge variant="success">Delivered</Badge>);
    const badge = screen.getByText("Delivered");
    expect(badge.className).toContain("bg-success-soft");
    expect(badge.className).toContain("text-success");
    expect(badge.className).toContain("text-body-sm");
  });

  it("renders cards with the design system surface", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Total parcels</CardTitle>
        </CardHeader>
        <CardContent>128</CardContent>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("rounded-card");
    expect(card.className).toContain("shadow-card");
    expect(card.className).toContain("border-border");
  });
});
