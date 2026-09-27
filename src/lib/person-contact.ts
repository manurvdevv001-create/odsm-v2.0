import type { Prisma } from "@prisma/client";
import { normalizePhoneNumber } from "@/lib/phone-number";

type Role = "guardian" | "staff";
type Identity = { firstName: string; lastName: string; middleName?: string | null };

export class PersonContactError extends Error {
    constructor(message: string, readonly status = 409) {
        super(message);
        this.name = "PersonContactError";
    }
}

type ResolvePersonContactInput = {
    schoolMatricule: string;
    role: Role;
    phone?: string | null;
    identity: Identity;
    selectedId?: string | null;
    existingRoleId?: string;
};

export async function resolvePersonContact(
    tx: Prisma.TransactionClient,
    input: ResolvePersonContactInput,
) {
    const normalized = input.phone ? normalizePhoneNumber(input.phone) : null;
    if (input.phone && !normalized) throw new PersonContactError("Le numéro de téléphone n'est pas valide.", 400);
    if (input.role === "guardian" && !normalized) throw new PersonContactError("Le téléphone du tuteur est obligatoire.", 400);

    const phone = normalized?.e164 ?? null;
    let contact = phone
        ? await tx.personContact.findUnique({
            where: { schoolMatricule_phone: { schoolMatricule: input.schoolMatricule, phone } },
            include: { guardian: true, staffProfile: true },
        })
        : null;
    const currentRole = input.existingRoleId
        ? input.role === "guardian"
            ? await tx.guardian.findUnique({ where: { id: input.existingRoleId }, include: { personContact: { include: { guardian: true, staffProfile: true } } } })
            : await tx.staffProfile.findUnique({ where: { id: input.existingRoleId }, include: { personContact: { include: { guardian: true, staffProfile: true } } } })
        : null;
    if (currentRole && currentRole.schoolMatricule !== input.schoolMatricule) {
        throw new PersonContactError("Cette fiche n'appartient pas à cet établissement.", 403);
    }
    const currentContact = currentRole?.personContact;

    if (contact && currentContact && contact.id !== currentContact.id) {
        throw new PersonContactError("Un numéro déjà attribué à une autre personne ne peut pas remplacer l'identité de cette fiche.");
    }
    if (!contact && currentContact) contact = currentContact;

    if (contact) {
        const selected = input.selectedId === contact.id;
        const alreadyOwnsRole = !!input.existingRoleId && (input.role === "guardian"
            ? contact.guardian?.id === input.existingRoleId
            : contact.staffProfile?.id === input.existingRoleId);
        if (!selected && !alreadyOwnsRole) {
            throw new PersonContactError(`Ce numéro appartient déjà à ${contact.lastName} ${contact.middleName || ""} ${contact.firstName}. Confirmez le rapprochement avant de continuer.`);
        }
        const roleHolder = input.role === "guardian" ? contact.guardian : contact.staffProfile;
        if (roleHolder && roleHolder.id !== input.existingRoleId) {
            throw new PersonContactError("Cette personne possède déjà une fiche de ce type dans cet établissement.");
        }
        if (alreadyOwnsRole) {
            if (input.role === "staff" && contact.guardian && !phone) {
                throw new PersonContactError("Le téléphone ne peut pas être supprimé tant que cette personne est également enregistrée comme tuteur.", 400);
            }
            const updatedContact = await tx.personContact.update({
                where: { id: contact.id },
                data: {
                    phone,
                    firstName: input.identity.firstName,
                    lastName: input.identity.lastName,
                    middleName: input.identity.middleName || null,
                },
                include: { guardian: true, staffProfile: true },
            });
            if (updatedContact.guardian && input.role !== "guardian") {
                await tx.guardian.update({ where: { id: updatedContact.guardian.id }, data: { firstName: updatedContact.firstName, lastName: updatedContact.lastName, middleName: updatedContact.middleName, phone: updatedContact.phone || "" } });
            }
            if (updatedContact.staffProfile && input.role !== "staff") {
                await tx.staffProfile.update({ where: { id: updatedContact.staffProfile.id }, data: { firstName: updatedContact.firstName, lastName: updatedContact.lastName, middleName: updatedContact.middleName, phone: updatedContact.phone } });
            }
            return { id: updatedContact.id, phone, identity: input.identity };
        }
        return {
            id: contact.id,
            phone,
            identity: { firstName: contact.firstName, lastName: contact.lastName, middleName: contact.middleName },
        };
    }

    if (phone) {
        const [guardians, staff] = await Promise.all([
            tx.guardian.findMany({ where: { schoolMatricule: input.schoolMatricule, personContactId: null }, select: { id: true, phone: true, firstName: true, lastName: true } }),
            tx.staffProfile.findMany({ where: { schoolMatricule: input.schoolMatricule, personContactId: null }, select: { id: true, phone: true, firstName: true, lastName: true, middleName: true } }),
        ]);
        const legacy = [
            ...guardians.filter(item => normalizePhoneNumber(item.phone)?.e164 === phone).map(item => ({ ...item, role: "guardian" as const })),
            ...staff.filter(item => normalizePhoneNumber(item.phone || "")?.e164 === phone).map(item => ({ ...item, role: "staff" as const })),
        ];

        if (legacy.length > 1) {
            throw new PersonContactError("Plusieurs fiches historiques utilisent ce numéro. Un administrateur doit résoudre ce conflit avant tout rapprochement.");
        }
        if (legacy.length === 1) {
            const match = legacy[0];
            const selectedLegacyId = `legacy:${match.role}:${match.id}`;
            const isExistingRole = match.role === input.role && match.id === input.existingRoleId;
            if (input.selectedId !== selectedLegacyId && !isExistingRole) {
                throw new PersonContactError(`Ce numéro est déjà attribué à ${match.lastName} ${match.firstName}. Confirmez le rapprochement avant de continuer.`);
            }
            if (match.role === input.role && !isExistingRole) {
                throw new PersonContactError("Cette personne possède déjà une fiche de ce type dans cet établissement.");
            }

            const identity = { firstName: match.firstName, lastName: match.lastName, middleName: "middleName" in match ? match.middleName : null };
            const createdContact = await tx.personContact.create({
                data: {
                    schoolMatricule: input.schoolMatricule,
                    phone,
                    ...identity,
                },
            });
            if (match.role === "guardian") {
                await tx.guardian.update({ where: { id: match.id }, data: { personContactId: createdContact.id, phone, middleName: createdContact.middleName } });
            } else {
                await tx.staffProfile.update({ where: { id: match.id }, data: { personContactId: createdContact.id, phone, firstName: createdContact.firstName, lastName: createdContact.lastName, middleName: createdContact.middleName } });
            }
            return { id: createdContact.id, phone, identity };
        }
    }

    if (input.selectedId) throw new PersonContactError("La fiche sélectionnée n'est plus disponible. Vérifiez de nouveau le numéro.", 400);

    const created = await tx.personContact.create({
        data: {
            schoolMatricule: input.schoolMatricule,
            phone,
            firstName: input.identity.firstName,
            lastName: input.identity.lastName,
            middleName: input.identity.middleName || null,
        },
    });
    return { id: created.id, phone, identity: input.identity };
}
