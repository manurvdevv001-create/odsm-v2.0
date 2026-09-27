'use client';

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { normalizePhoneNumber } from "@/lib/phone-number";

type ContactMatch = {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    roles?: { guardian: boolean; staff: boolean };
    role?: "guardian" | "staff";
};

type LookupResult = {
    phone: string;
    contact: ContactMatch | null;
    legacyMatches?: ContactMatch[];
};

export function PersonPhoneField({
    matricule,
    value,
    onChange,
    selectedId,
    onSelect,
    onIdentityMatch,
    required = false,
}: {
    matricule: string;
    value: string;
    onChange: (value: string) => void;
    selectedId: string;
    onSelect: (id: string) => void;
    onIdentityMatch: (match: ContactMatch) => void;
    required?: boolean;
}) {
    const [matches, setMatches] = useState<LookupResult | null>(null);
    const [lookupError, setLookupError] = useState("");
    const [isLookingUp, setIsLookingUp] = useState(false);

    const lookup = async () => {
        if (!value.trim() || !matricule) return;
        const normalized = normalizePhoneNumber(value);
        if (!normalized) {
            setMatches(null);
            setLookupError("Saisissez un numéro valide avec l'indicatif international, ou un numéro RDC local.");
            return;
        }

        setIsLookingUp(true);
        setLookupError("");
        try {
            const params = new URLSearchParams({ matricule, phone: normalized.e164 });
            const response = await fetch(`/api/person-contacts/lookup?${params.toString()}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "La vérification du numéro a échoué.");
            onChange(result.phone);
            setMatches(result);
            if (result.contact) onIdentityMatch(result.contact);
        } catch (error) {
            setLookupError(error instanceof Error ? error.message : "La vérification du numéro a échoué.");
            setMatches(null);
        } finally {
            setIsLookingUp(false);
        }
    };

    const selectMatch = (match: ContactMatch, id: string) => {
        onSelect(id);
        onIdentityMatch(match);
    };

    return (
        <div className="space-y-2">
            <Label htmlFor="person-phone">Téléphone {required && <span className="text-red-500">*</span>}</Label>
            <div className="flex gap-2">
                <Input
                    id="person-phone"
                    required={required}
                    value={value}
                    placeholder="0811234567 ou +243811234567"
                    onChange={event => {
                        onChange(event.target.value);
                        onSelect("");
                        setMatches(null);
                        setLookupError("");
                    }}
                    onBlur={lookup}
                />
                <Button type="button" variant="outline" disabled={isLookingUp} onClick={lookup}>
                    {isLookingUp ? "Vérification..." : "Vérifier"}
                </Button>
            </div>
            {lookupError && <p role="alert" className="text-sm text-destructive">{lookupError}</p>}
            {matches?.contact && (
                <div className="rounded-md border p-3 text-sm">
                    <p>
                        Ce numéro appartient à <strong>{matches.contact.lastName} {matches.contact.middleName || ""} {matches.contact.firstName}</strong>.
                        Confirmez le rapprochement avant d’ajouter ce rôle.
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant={selectedId === matches.contact.id ? "default" : "outline"}
                        className="mt-2"
                        onClick={() => selectMatch(matches.contact!, matches.contact!.id)}
                    >
                        {selectedId === matches.contact.id ? "Rapprochement confirmé" : "Utiliser cette personne"}
                    </Button>
                </div>
            )}
            {(matches?.legacyMatches?.length || 0) > 0 && (
                <div className="space-y-2 rounded-md border p-3 text-sm">
                    <p>Une fiche existante utilise ce numéro. Confirmez la personne à rattacher :</p>
                    {matches?.legacyMatches?.map(match => {
                        const id = `legacy:${match.role}:${match.id}`;
                        return (
                            <div key={id} className="flex flex-wrap items-center justify-between gap-2">
                                <span>{match.lastName} {match.middleName || ""} {match.firstName} ({match.role === "staff" ? "Personnel" : "Tuteur"})</span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={selectedId === id ? "default" : "outline"}
                                    onClick={() => selectMatch(match, id)}
                                >
                                    {selectedId === id ? "Rapprochement confirmé" : "Confirmer"}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
            {matches && !matches.contact && !matches.legacyMatches?.length && (
                <p className="text-sm text-muted-foreground">Numéro disponible dans cet établissement : {matches.phone}</p>
            )}
        </div>
    );
}
