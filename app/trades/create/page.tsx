"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, Check, ChevronsUpDown, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Helper to parse price strings handling both comma and dot as decimal separators
function parsePrice(value: string): number {
    // Remove spaces and currency symbols
    let cleaned = value.trim().replace(/[$€£]/g, '');

    // If contains both comma and dot, assume last one is decimal separator
    if (cleaned.includes(',') && cleaned.includes('.')) {
        // Assume US format: 1,234.56
        cleaned = cleaned.replace(/,/g, '');
    } else if (cleaned.includes(',')) {
        // Could be either "1,234" (thousands) or "1,23" (European decimal)
        // If comma position from end is 3, it's thousands separator
        const commaPos = cleaned.length - cleaned.lastIndexOf(',') - 1;
        if (commaPos === 3 && !cleaned.includes('.')) {
            cleaned = cleaned.replace(/,/g, '');
        } else {
            // European decimal format
            cleaned = cleaned.replace(',', '.');
        }
    }

    return parseFloat(cleaned);
}

const formSchema = z.object({
    direction: z.enum(["long", "short"]),
    entryPrice: z.string().refine((val) => !isNaN(parsePrice(val)) && parsePrice(val) > 0, {
        message: "Entry price must be a positive number",
    }),
    stopLoss: z.string().refine((val) => !isNaN(parsePrice(val)) && parsePrice(val) > 0, {
        message: "Stop loss must be a positive number",
    }),
    takeProfits: z.array(
        z.object({
            price: z.string().refine((val) => !isNaN(parsePrice(val)) && parsePrice(val) > 0, {
                message: "TP price must be a positive number",
            }),
        })
    ).min(1, "At least one Take Profit is required"),
    aiStrategyId: z.string().min(1, "Please select an AI strategy"),
}).superRefine((data, ctx) => {
    const entry = parsePrice(data.entryPrice);
    const sl = parsePrice(data.stopLoss);
    const tps = data.takeProfits.map(tp => parsePrice(tp.price));

    if (data.direction === "long") {
        // For LONG: SL must be below entry, TPs must be above entry
        if (sl >= entry) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "For LONG trades, Stop Loss must be below Entry Price",
                path: ["stopLoss"],
            });
        }
        tps.forEach((tp, idx) => {
            if (tp <= entry) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "For LONG trades, Take Profit must be above Entry Price",
                    path: ["takeProfits", idx, "price"],
                });
            }
        });
    } else {
        // For SHORT: SL must be above entry, TPs must be below entry
        if (sl <= entry) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "For SHORT trades, Stop Loss must be above Entry Price",
                path: ["stopLoss"],
            });
        }
        tps.forEach((tp, idx) => {
            if (tp >= entry) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "For SHORT trades, Take Profit must be below Entry Price",
                    path: ["takeProfits", idx, "price"],
                });
            }
        });
    }
});

export default function CreateTradePage() {
    const router = useRouter();
    const [strategies, setStrategies] = useState<{ id: string; name: string }[]>(
        []
    );
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            direction: "long",
            entryPrice: "",
            stopLoss: "",
            takeProfits: [{ price: "" }],
            aiStrategyId: "",
        },
    });

    const supabase = createClient();
    const takeProfits = form.watch("takeProfits");

    useEffect(() => {
        const fetchStrategies = async () => {
            const { data, error } = await supabase.from("ai_strategies").select("id, name, user_id");

            if (error) {
                console.warn("[CreateTrade] Could not fetch user_id, falling back...", error.message);
                const { data: fallback, error: fallbackErr } = await supabase.from("ai_strategies").select("id, name");
                if (fallbackErr) {
                    toast.error("Failed to load AI strategies");
                    return;
                }
                setStrategies(fallback || []);
            } else {
                setStrategies(data || []);
            }
        };

        fetchStrategies();
    }, []);

    const createStrategy = async () => {
        if (!query) return;

        const newStrategyName = query;
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            toast.error("You must be logged in to create a strategy");
            return;
        }

        try {
            // Attempt to insert with user_id
            let payload: any = {
                name: newStrategyName,
                description: 'User created strategy',
                user_id: user.id
            };

            let { data, error } = await supabase.from('ai_strategies').insert(payload).select().single();

            // If it fails with user_id missing, try without it
            if (error && error.message.includes('user_id')) {
                console.warn("[CreateTrade] user_id column missing, inserting without it...");
                delete payload.user_id;
                const { data: fallbackData, error: fallbackError } = await supabase.from('ai_strategies').insert(payload).select().single();
                data = fallbackData;
                error = fallbackError;
            }

            if (error) throw error;

            if (data) {
                setStrategies((prev) => [...prev, data]);
                form.setValue("aiStrategyId", data.id);
                setOpen(false);
                setQuery("");
                toast.success(`Strategy "${data.name}" created`);
            }
        } catch (error: any) {
            console.error("Error creating strategy:", error);
            toast.error("Failed to create strategy");
        }
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true);
        console.log("Submitting trade...", values);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                toast.error("You must be logged in to create a trade");
                router.push("/login");
                return;
            }

            // 1. Create Trade
            const { data: trade, error: tradeError } = await supabase
                .from("trades")
                .insert({
                    user_id: user.id,
                    direction: values.direction,
                    entry_price: parsePrice(values.entryPrice),
                    sl: parsePrice(values.stopLoss),
                    status: "pending_entry",
                    position_size: 1000,
                    remaining_position: 1000,
                })
                .select()
                .single();

            if (tradeError) {
                console.error("Trade Insert Error:", tradeError);
                throw new Error(`Trade insert failed: ${tradeError.message}`);
            }

            // 2. Create TPs
            const tps = values.takeProfits.map((tp) => ({
                trade_id: trade.id,
                tp_price: parsePrice(tp.price),
            }));

            const { error: tpError } = await supabase.from("trade_tps").insert(tps);
            if (tpError) throw new Error(`TP insert failed: ${tpError.message}`);

            // 3. Associate with AI Strategy
            const { error: aiError } = await supabase
                .from("trade_ai_attribution")
                .insert({
                    trade_id: trade.id,
                    ai_strategy_id: values.aiStrategyId,
                });

            if (aiError) throw new Error(`AI attribution failed: ${aiError.message}`);

            toast.success("Paper trade created successfully!");

            // Trigger background sync immediately
            fetch("/api/trades/sync").catch(err => console.error("Initial sync failed", err));

            router.push("/dashboard");
        } catch (error: any) {
            console.error("Error creating trade:", error);
            toast.error(error.message || "Failed to create trade");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container max-w-3xl mx-auto py-12 px-6">
            <div className="mb-8 space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">New Paper Trade</h1>
                <p className="text-muted-foreground">
                    Simulate a new trade position and track its performance against your AI strategies.
                </p>
            </div>

            <div className="grid gap-8">
                <Card className="shadow-md border-muted/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            Trade Configuration
                        </CardTitle>
                        <CardDescription>
                            Define the parameters for your simulated trade.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                                {/* Direction Selection */}
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="direction"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-base font-semibold">Market Direction</FormLabel>
                                                <div className="flex gap-4">
                                                    <div
                                                        className={cn(
                                                            "cursor-pointer flex-1 border rounded-lg p-4 flex items-center justify-center gap-2 transition-all hover:border-primary",
                                                            field.value === 'long' ? "border-green-500 bg-green-50/50 ring-1 ring-green-500" : "bg-card"
                                                        )}
                                                        onClick={() => field.onChange("long")}
                                                    >
                                                        <TrendingUp className={cn("h-5 w-5", field.value === 'long' ? "text-green-600" : "text-muted-foreground")} />
                                                        <span className={cn("font-medium", field.value === 'long' ? "text-green-700" : "text-foreground")}>Long</span>
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "cursor-pointer flex-1 border rounded-lg p-4 flex items-center justify-center gap-2 transition-all hover:border-primary",
                                                            field.value === 'short' ? "border-red-500 bg-red-50/50 ring-1 ring-red-500" : "bg-card"
                                                        )}
                                                        onClick={() => field.onChange("short")}
                                                    >
                                                        <TrendingDown className={cn("h-5 w-5", field.value === 'short' ? "text-red-600" : "text-muted-foreground")} />
                                                        <span className={cn("font-medium", field.value === 'short' ? "text-red-700" : "text-foreground")}>Short</span>
                                                    </div>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="entryPrice"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Entry Price (ETH)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                                        <Input placeholder="0.00" className="pl-7" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="stopLoss"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Stop Loss (ETH)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                                        <Input placeholder="0.00" className="pl-7" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Take Profits Section */}
                                <div className="rounded-lg border p-4 bg-muted/20 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <FormLabel className="text-base">Take Profits</FormLabel>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const currentTps = form.getValues("takeProfits");
                                                form.setValue("takeProfits", [...currentTps, { price: "" }]);
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-2" /> Add Level
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {takeProfits.map((_, index) => (
                                            <div key={index} className="flex gap-3 items-start">
                                                <FormField
                                                    control={form.control}
                                                    name={`takeProfits.${index}.price`}
                                                    render={({ field }) => (
                                                        <FormItem className="flex-1">
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-2.5 text-muted-foreground text-xs">TP {index + 1}</span>
                                                                    <Input placeholder="Price" className="pl-12" {...field} />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                {takeProfits.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-muted-foreground hover:text-destructive"
                                                        onClick={() => {
                                                            const currentTps = form.getValues("takeProfits");
                                                            form.setValue(
                                                                "takeProfits",
                                                                currentTps.filter((_, i) => i !== index)
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="aiStrategyId"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <div className="flex flex-col gap-1">
                                                <FormLabel className="text-base">AI Strategy Attribution</FormLabel>
                                                <p className="text-xs text-muted-foreground">Which strategy generated this signal?</p>
                                            </div>
                                            <Popover open={open} onOpenChange={setOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            aria-expanded={open}
                                                            className={cn(
                                                                "w-full justify-between pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value
                                                                ? strategies.find(
                                                                    (strategy) => strategy.id === field.value
                                                                )?.name
                                                                : "Select or creation a strategy"}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput
                                                            placeholder="Search strategy..."
                                                            value={query}
                                                            onValueChange={setQuery}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                <div className="p-4 text-center">
                                                                    <p className="text-sm text-muted-foreground mb-3">No strategy found.</p>
                                                                    <Button
                                                                        size="sm"
                                                                        className="w-full"
                                                                        onClick={createStrategy}
                                                                    >
                                                                        <Plus className="mr-2 h-3 w-3" />
                                                                        Create "{query}"
                                                                    </Button>
                                                                </div>
                                                            </CommandEmpty>
                                                            <CommandGroup heading="Existing Strategies">
                                                                {strategies.map((strategy) => (
                                                                    <CommandItem
                                                                        value={strategy.name}
                                                                        key={strategy.id}
                                                                        onSelect={() => {
                                                                            form.setValue("aiStrategyId", strategy.id);
                                                                            setOpen(false);
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                strategy.id === field.value
                                                                                    ? "opacity-100"
                                                                                    : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {strategy.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="pt-4">
                                    <Button type="submit" size="lg" className="w-full font-semibold shadow-md" disabled={loading}>
                                        {loading ? "Creating..." : "Create Paper Trade"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
