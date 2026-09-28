# Bossbuss

En snabb webbplats på svenska för **bossbuss.com**, byggd med Astro och förberedd för Cloudflare Workers. Öppna projektmappen i VS Code.

GitHub-repo: <https://github.com/Filip-Samtech/bossbuss-website>

## Starta lokalt

Installera Node.js 24.16.0, som också anges i `.nvmrc` för Cloudflares byggmiljö. Beroendena kräver minst Node.js 22.19.0. Öppna terminalen i projektmappen och kör:

```sh
npm ci
npm run dev
```

Öppna adressen som terminalen visar, normalt http://localhost:4321. På Windows kan `npm.cmd` användas om PowerShell blockerar `npm.ps1`.

`npm run dev` visar webbplatsen. För att också köra Cloudflare-funktionen för formuläret lokalt använder du `npm run preview:cloudflare`, normalt på http://localhost:8787.

## Sidor och innehåll

- Start: `src/pages/index.astro`
- Om oss: `src/pages/om-oss.astro`
- Vision: `src/pages/vision.astro`
- Busstjänster: `src/pages/busstjanster.astro`
- Kontakt: `src/pages/kontakt.astro`
- Gemensamma kontaktuppgifter, meny och tjänster: `src/data.ts`
- Utseende och mobilanpassning: `src/styles/global.css`
- Kontaktformulär: `src/components/Contact.astro`
- Serverfunktion för e-post: `worker/index.mjs`
- Logotyper och optimerade bilder: `public/images/`

Formuläret finns längst ner på alla sidor. Suad Sarajlija, VD, är kontaktperson. E-post är info@bossbuss.com, telefon +46 76 881 91 20 och besöksadress Tallbacksgatan 11G, 195 72 Rosersberg.

## Publicera på Cloudflare

Webbplatsen använder **Cloudflare Workers med statiska assets**, som Astro rekommenderar för nya Cloudflare-projekt. Sidorna förbyggs till HTML. Bara `/api/contact` behöver köra serverkod. Ingen Astro Cloudflare-adapter behövs för detta upplägg.

### Automatisk publicering från GitHub

I **Workers & Pages**, skapa en **Worker** genom att importera `Filip-Samtech/bossbuss-website` från GitHub. Välj produktionsgrenen `main`, projektrot `/`, byggkommando `npm run build` och publiceringskommando `npx wrangler deploy`. Låt Worker-namnet vara `bossbuss`, som i `wrangler.jsonc`. Node-versionen hämtas från `.nvmrc`; om en `NODE_VERSION` redan är inställd i Cloudflare, ändra den till `24.16.0` så att inställningarna stämmer överens.

Projektet är konfigurerat för Workers. En Pages-logg som efterfrågar `pages_build_output_dir` betyder att ett Pages-projekt valts. Skapa då Worker-projektet enligt ovan. Att bara lägga till `pages_build_output_dir` eller publicera `dist` i Pages kopplar inte in den befintliga kontaktfunktionen och dess rate limiter.

### Manuell publicering via terminalen

1. Logga in på ditt Cloudflare-konto:

   ```sh
   npx wrangler login
   ```

2. Kör kontrollerna och publicera:

   ```sh
   npm run check
   npm test
   npm run deploy
   ```

3. Öppna **Workers & Pages → bossbuss → Settings → Domains & Routes → Add → Custom Domain** och anslut `bossbuss.com`. Domänen behöver finnas som en aktiv zon på det Cloudflare-kontot. Lägg vid behov till `www.bossbuss.com` och en omdirigering till huvuddomänen. Ändra inte befintliga MX-poster för företagets e-post.

4. Kontrollera startsidan, alla fyra menyalternativ, telefon- och e-postlänkar samt formuläret på den publicerade domänen.

För automatisk publicering via ett eget Git-repo: koppla repot till Cloudflare Workers Builds, använd `npm run build` som build-kommando och `npx wrangler deploy` som deploy-kommando. Om repot innehåller flera projekt, välj katalogen där den här `package.json` ligger som rotkatalog.

GitHub behövs inte för en manuell Cloudflare-publicering, men det är den rekommenderade platsen för versionshistorik och framtida ändringar. När Cloudflare är tillgängligt kopplar du repot i Workers & Pages under **Builds → Connect to Git**. Då kan varje push till `main` bygga och publicera automatiskt. Byggkommando är `npm run build`; statiska filer byggs till `dist` och Worker-konfigurationen finns i `wrangler.jsonc`. Kontaktformulärets `RESEND_API_KEY` ska läggas som en Cloudflare Secret, inte i GitHub.

## Aktivera kontaktformulärets e-post

Formulärets mottagare är **info@bossbuss.com**. Mottagaradressen skapar ingen brevlåda: den måste redan finnas hos er e-postleverantör.

Koden använder Resend för leverans och behöver en serverhemlighet. Ingen e-postnyckel finns i projektet.

1. Skapa ett Resend-konto och verifiera avsändardomänen `bossbuss.com` enligt Resends DNS-instruktioner. Lägg endast till de begärda posterna; behåll befintlig inkommande e-postkonfiguration.
2. Skapa en API-nyckel med behörighet att skicka mejl för domänen.
3. Lägg till nyckeln direkt via terminalen, inte i källkoden eller i chatten:

   ```sh
   npx wrangler secret put RESEND_API_KEY
   ```

4. Avsändaren är `Bossbuss webbplats <webb@bossbuss.com>` och mottagaren `info@bossbuss.com`, konfigurerade i `wrangler.jsonc`. Besökarens e-post används som `Reply-To`, så att ni kan svara direkt.
5. För ett lokalt test: kopiera `.dev.vars.example` till `.dev.vars`, fyll i nyckeln och kör `npm run preview:cloudflare`. `.dev.vars` är ignorerad av Git. Ett test med riktig nyckel skickar ett riktigt mejl.
6. Skicka ett eget test från webbplatsen och kontrollera både inkorgen och skräpposten innan lansering.

Utan nyckel eller vid leveransfel visas ett tydligt felmeddelande och direkta kontaktuppgifter. Formuläret visar aldrig en lyckad leverans enbart för att besökaren tryckt på knappen. Besökarens text bevaras vid fel när JavaScript är aktiverat. Bekräftelsen betyder att e-posttjänsten har accepterat meddelandet, inte att slutlig inkorgsleverans är garanterad.

Servern validerar alla fält, begränsar meddelandets storlek, kontrollerar samma ursprung, använder ett dolt spamfält och begränsar utskick till fem per minut per IP vid Cloudflares lokala rate limiter. Meddelanden lagras inte i en egen databas. Uppgifterna behandlas av Cloudflare, Resend och er e-postleverantör för leverans och svar. Säkerställ att er information om personuppgiftshantering speglar det slutliga arbetssättet före lansering.

## Teknik och prestanda

- Statisk HTML från Astro; inget React eller stort klientramverk.
- Lokalt levererat variabelt Manrope-typsnitt, inga Google Fonts-anrop.
- SVG-logotyp extraherad från den bifogade original-PDF:en.
- Bilder i WebP med mindre alternativ för mobiler.
- Responsiv layout, tangentbordsnavigation, hoppa-till-innehåll-länk och stöd för minskad rörelse.
- Sidtitlar, metabeskrivningar, canonical-länkar, sitemap, robots.txt och en riktig 404-sida.
- Inga analysverktyg, inbäddade kartor eller cookies tillagda.

## Kontroller

```sh
npm run check
npm test
npm run build
npx wrangler deploy --dry-run
```

Testerna använder en simulerad e-posttjänst och skickar inga mejl. De kontrollerar bland annat validering, mottagare, rate limiting, leveransfel och formulärsvar utan JavaScript. Se `VERIFIERING.md` för genomförda kontroller och återstående steg.

## Referens och material

Strukturen och det relevanta bussinnehållet utgår från [Ofgrulias webbplats](https://www.ofgrulia.se/), särskilt [Om oss](https://www.ofgrulia.se/om-oss), [Vision](https://www.ofgrulia.se/copy-of-om-oss), [Busstjänster](https://www.ofgrulia.se/busstj%C3%A4nster) och [Kontakt](https://www.ofgrulia.se/kontakt). Texterna är omarbetade för Bossbuss. Det gamla bolagets startår, byggverksamhet, godsverksamhet och övriga personal har inte förts över. Inga påståenden om antal bussar, säten, certifieringar eller priser har lagts till.

De två fotografiska varumärkesbilderna och logotypen kommer från det material användaren tillhandahållit. De används som profilbilder och visar inte en verifierad bussflotta. Manrope distribueras under SIL Open Font License; licensen följer med paketet `@fontsource-variable/manrope`.

Dokumentation: [Astro på Cloudflare](https://docs.astro.build/en/guides/deploy/cloudflare/), [Cloudflare statiska assets och Worker-routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [Resend e-post-API](https://resend.com/docs/api-reference/emails/send-email).
