"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

export function Navbar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const links = [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/trades/create", label: "New Trade" },
        { href: "/login", label: "Login" },
    ];

    return (
        <nav className="border-b">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/dashboard" className="font-bold text-xl">
                    AI Trading Gym
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex gap-6">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "text-sm font-medium transition-colors hover:text-primary",
                                pathname === link.href
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                            )}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* Mobile Menu */}
                <div className="md:hidden">
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-6 w-6" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right">
                            <div className="flex flex-col gap-4 mt-8">
                                {links.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "text-lg font-medium transition-colors hover:text-primary",
                                            pathname === link.href
                                                ? "text-foreground"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    );
}
