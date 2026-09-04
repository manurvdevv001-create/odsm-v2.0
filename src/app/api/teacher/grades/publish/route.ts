// src/app/api/teacher/grades/publish/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { assessmentId, action } = await req.json();

        if (!assessmentId || !action) {
            return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
        }

        const result = await db.$transaction(async (tx: any) => {
            const assessment = await tx.assessment.findUnique({
                where: { id: assessmentId },
                include: { results: true }
            });

            if (!assessment) throw new Error("Épreuve non trouvée");

            if (action === "PUBLISH") {
                // 1. Mark as published
                // Use 'as any' to bypass stale Prisma client validation in dev
                await (tx.assessment as any).update({
                    where: { id: assessmentId },
                    data: {
                        isPublished: true,
                        hasPendingChanges: false,
                        publishedAt: new Date()
                    } as any
                });

                // 2. Snapshot current scores to publishedScores
                for (const res of assessment.results) {
                    await (tx.studentResult as any).update({
                        where: { id: res.id },
                        data: {
                            publishedScore: res.score,
                            publishedExempt: res.isExempt
                        } as any
                    });
                }
            } else if (action === "REVERT") {
                // 1. Revert current scores to published ones
                for (const res of assessment.results) {
                    await (tx.studentResult as any).update({
                        where: { id: res.id },
                        data: {
                            score: (res as any).publishedScore,
                            isExempt: (res as any).publishedExempt
                        } as any
                    });
                }

                // 2. Clear pending flag
                await (tx.assessment as any).update({
                    where: { id: assessmentId },
                    data: {
                        hasPendingChanges: false
                    } as any
                });
            } else if (action === "KEEP") {
                // Just acknowledge the situation, no changes to data
            } else {
                throw new Error("Action non reconnue");
            }

            return { success: true };
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Publish Grade Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
