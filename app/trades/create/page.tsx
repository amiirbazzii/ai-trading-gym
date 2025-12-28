"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2 } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const formSchema = z.object({
    direction: z.enum(["long", "short"]),
    entryPrice: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Entry price must be a positive number",
    }),
    stopLoss: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Stop loss must be a positive number",
    }),
    takeProfits: z.array(
        z.object({
            price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
                message: "TP price must be a positive number",
            }),
        })
    ).min(1, "At least one Take Profit is required"),
    aiStrategyId: z.string().min(1, "Please select an AI strategy"),
});

export default function CreateTradePage() {
    const router = useRouter();
    const [strategies, setStrategies] = useState<{ id: string; name: string }[]>(
        []
    );
    const [loading, setLoading] = useState(false);

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
            const { data, error } = await supabase.from("ai_strategies").select("id, name");
            if (error) {
                console.error("Error fetching strategies:", error);
                toast.error("Failed to load AI strategies");
            } else {
                setStrategies(data || []);
            }
        };

        fetchStrategies();
    }, []);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true);
        console.log("Submitting trade...", values);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                toast.error("You must be logged in to create a trade");
                console.error("No user found in session");
                // Redirect to login if not logged in
                router.push("/login");
                return;
            }

            console.log("User found:", user.id);

            // 1. Create Trade
            console.log("Inserting trade...");
            const { data: trade, error: tradeError } = await supabase
                .from("trades")
                .insert({
                    user_id: user.id,
                    direction: values.direction,
                    entry_price: Number(values.entryPrice),
                    sl: Number(values.stopLoss),
                    status: "open",
                })
                .select()
                .single();

            if (tradeError) {
                console.error("Trade Insert Error:", tradeError);
                throw new Error(`Trade insert failed: ${tradeError.message} (${tradeError.code})`);
            }

            console.log("Trade created:", trade);

            // 2. Create TPs
            const tps = values.takeProfits.map((tp) => ({
                trade_id: trade.id,
                tp_price: Number(tp.price),
            }));

            const { error: tpError } = await supabase.from("trade_tps").insert(tps);
            if (tpError) {
                console.error("TP Insert Error:", tpError);
                throw new Error(`TP insert failed: ${tpError.message}`);
            }

            // 3. Associate with AI Strategy
            const { error: aiError } = await supabase
                .from("trade_ai_attribution")
                .insert({
                    trade_id: trade.id,
                    ai_strategy_id: values.aiStrategyId,
                });

            if (aiError) {
                console.error("AI Attribution Error:", aiError);
                throw new Error(`AI attribution failed: ${aiError.message}`);
            }

            console.log("All inserts successful");
            toast.success("Paper trade created successfully!");
            router.push("/dashboard");
        } catch (error: any) {
            console.error("Error creating trade:", error);
            toast.error(error.message || "Failed to create trade");
            // Do NOT redirect, let user see the error
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container max-w-2xl mx-auto py-10">
            <Card>
                <CardHeader>
                    <CardTitle>Create Paper Trade</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="direction"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Direction</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select direction" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="long">Long</SelectItem>
                                                <SelectItem value="short">Short</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="entryPrice"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Entry Price (ETH)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="0.00" {...field} />
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
                                                <Input placeholder="0.00" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-4">
                                <FormLabel>Take Profits</FormLabel>
                                {takeProfits.map((_, index) => (
                                    <div key={index} className="flex gap-2">
                                        <FormField
                                            control={form.control}
                                            name={`takeProfits.${index}.price`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input placeholder={`TP ${index + 1} Price`} {...field} />
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
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => {
                                        const currentTps = form.getValues("takeProfits");
                                        form.setValue("takeProfits", [...currentTps, { price: "" }]);
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add TP
                                </Button>
                            </div>

                            <FormField
                                control={form.control}
                                name="aiStrategyId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>AI Strategy Attribution</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select AI Strategy" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {strategies.map((strategy) => (
                                                    <SelectItem key={strategy.id} value={strategy.id}>
                                                        {strategy.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Creating..." : "Create Paper Trade"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
