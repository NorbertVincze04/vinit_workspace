/**
 * The three built-in wiki pages (migration 012; the plans page as corrected by migration 017, and the
 * original version, which stays in the page history). Matched on the whole text: an edited page shows
 * as written.
 */
const ONBOARDING_EN = `How a new salon goes live in under 48 hours. The clock starts when **all the client's materials** have arrived (see the Onboarding tool).

## 1. Collect the materials
- Logo (vector or high resolution) and brand colours
- Services with durations and prices
- Opening hours, barbers (name and photo)
- Photos of the salon
- The domain they want (check it is free, note who owns it)

## 2. Kickoff session (30 min, included session 1)
Walk through the materials and the owner's wishes. Log it in Support as an included session.

## 3. Configure
- Write the tenant JSON config in the booking product
- Connect the domain: DNS, then SSL

## 4. Prototype approval (30 min, included session 2)
The owner approves the site. Changes after approval are extra work (100 RON/h).

## 5. Launch
- Test booking end to end (book, confirmation, cancel)
- Owner portal access, QR stand, announce on Instagram
- Press **Go live** in the Onboarding tab`;

const ONBOARDING_RO = `Cum pornește un salon nou în mai puțin de 48 de ore. Cronometrul începe când au sosit **toate materialele clientului** (vezi instrumentul Onboarding).

## 1. Strânge materialele
- Logo (vectorial sau la rezoluție mare) și culorile brandului
- Serviciile, cu durate și prețuri
- Programul, frizerii (nume și poză)
- Fotografii cu salonul
- Domeniul dorit (verifică dacă e liber, notează cine îl deține)

## 2. Ședința de început (30 min, ședința inclusă 1)
Treceți prin materiale și dorințele proprietarului. Înregistreaz-o în Suport ca ședință inclusă.

## 3. Configurează
- Scrie configurarea JSON a salonului în produsul de programări
- Conectează domeniul: DNS, apoi SSL

## 4. Aprobarea prototipului (30 min, ședința inclusă 2)
Proprietarul aprobă site-ul. Modificările de după aprobare sunt muncă suplimentară (100 RON/h).

## 5. Lansare
- Testează programarea de la cap la coadă (programare, confirmare, anulare)
- Acces la portalul proprietarului, standul cu cod QR, anunț pe Instagram
- Apasă **Pornește site-ul** în fila Onboarding`;

const PLANS_HEAD_EN = `## Plans
| Plan | Price | Included |
|---|---|---|
| Standard Barbershop | 150 RON / month | 2 × 30-min sessions |
| Premium Brand | 200 RON / month | SMS/WhatsApp reminders, waitlist, punch card, client notes, 2 sessions |
| Custom | from 1.000 RON one-off, or a subscription of at least 4 months | 3 sessions |

Extra work (structural changes, redesign after approval, new features): **100 RON/h**.

## Offers
- **Early Bird**: 3 months free for the first 50 salons (beta salons don't count).
- **Beta**: the 5 free beta salons.
- **Referral** (month 10): bring a salon, get 3 months free.

## Targets
`;
const PLANS_HEAD_RO = `## Abonamente
| Abonament | Preț | Include |
|---|---|---|
| Standard Barbershop | 150 RON / lună | 2 ședințe de 30 de minute |
| Premium Brand | 200 RON / lună | Mementouri prin SMS/WhatsApp, listă de așteptare, card de fidelitate, notițe despre clienți, 2 ședințe |
| Personalizat | de la 1.000 RON o singură dată, sau abonament de minimum 4 luni | 3 ședințe |

Muncă suplimentară (modificări structurale, redesign după aprobare, funcționalități noi): **100 RON/h**.

## Oferte
- **Early Bird**: 3 luni gratuite pentru primele 50 de saloane (saloanele beta nu se pun la socoteală).
- **Beta**: cele 5 saloane beta gratuite.
- **Recomandare** (luna 10): aduci un salon, primești 3 luni gratuite.

## Ținte
`;
const PLANS_EN = `${PLANS_HEAD_EN}- Break-even: 46 salons on Standard (monthly costs 6.860 RON: 3.080 operational + 3.780 salaries)
- Year 1: 50 salons, 7.500 RON MRR, retention ≥ 70%`;
const PLANS_RO = `${PLANS_HEAD_RO}- Pragul de rentabilitate: 46 de saloane pe Standard (costuri lunare 6.860 RON: 3.080 operaționale + 3.780 salarii)
- Anul 1: 50 de saloane, 7.500 RON MRR, retenție ≥ 70%`;
const PLANS_OLD_EN = `${PLANS_HEAD_EN}- Break-even: 43 salons on Standard (monthly costs 6.380 RON)
- Year 1: 50 salons, 7.500 RON MRR, retention ≥ 70%`;
const PLANS_OLD_RO = `${PLANS_HEAD_RO}- Pragul de rentabilitate: 43 de saloane pe Standard (costuri lunare 6.380 RON)
- Anul 1: 50 de saloane, 7.500 RON MRR, retenție ≥ 70%`;

const BACKUPS_EN = `The database (with every uploaded file) lives in the Docker volume \`vinit_pgdata\` on this PC.

## Back up
\`\`\`
npm run db:backup
\`\`\`
This writes \`backups/vinit-<date>.dump\`. **Copy it somewhere else** (external drive, cloud folder): a backup on the same disk doesn't survive a dead disk.

## Restore
\`\`\`
npm run db:restore -- backups/<file>.dump --yes
docker compose restart api
\`\`\`
This replaces everything. Test a restore now and then (record it in Infra › Backups).

## Passwords
Never store passwords in the workspace. Keep them in the password manager and only note *where* they are.`;

const BACKUPS_RO = `Baza de date (cu toate fișierele încărcate) se află în volumul Docker \`vinit_pgdata\` de pe acest PC.

## Copie de siguranță
\`\`\`
npm run db:backup
\`\`\`
Comanda scrie \`backups/vinit-<data>.dump\`. **Copiaz-o și în alt loc** (disc extern, folder în cloud): o copie pe același disc nu supraviețuiește unui disc defect.

## Restaurare
\`\`\`
npm run db:restore -- backups/<fișier>.dump --yes
docker compose restart api
\`\`\`
Comanda înlocuiește tot. Testează din când în când o restaurare (înregistreaz-o în Infrastructură › Copii de siguranță).

## Parole
Nu păstra niciodată parole în spațiul de lucru. Ține-le în managerul de parole și notează doar *unde* se află.`;

export const WIKI_CONTENT: readonly (readonly [string, string])[] = [
  ['Onboarding a salon in 48 hours', 'Onboardingul unui salon în 48 de ore'],
  ['Plans, prices and offers', 'Abonamente, prețuri și oferte'],
  ['Backups and restore', 'Copii de siguranță și restaurare'],
  [ONBOARDING_EN, ONBOARDING_RO],
  [PLANS_EN, PLANS_RO],
  [PLANS_OLD_EN, PLANS_OLD_RO],
  [BACKUPS_EN, BACKUPS_RO],
];
