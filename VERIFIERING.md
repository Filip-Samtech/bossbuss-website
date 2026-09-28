# Verifiering och leveransstatus

Kontrollerat 28 september 2026.

## Genomfört

- `astro check`: 15 Astro-filer, 0 fel och 0 varningar.
- Produktionsbygge: startsida, fyra undersidor och en 404-sida genereras.
- 11 automatiska tester för serverfunktionen passerar. E-posttjänsten är simulerad i testerna; inga externa mejl har skickats.
- Cloudflare Wrangler dry run passerar. Worker, statiska filer, mottagare och rate limiter identifieras korrekt.
- Lokal Cloudflare-runtime: alla fem vanliga sidor svarar 200, 12 interna länkar/assets svarar 200, okänd sida svarar 404 med den egna felsidan.
- Serverfunktionen svarar 503 när e-postnyckeln saknas och 403 för formulär från ett annat ursprung.
- Undersidorna kontrollerade vid 320, 768 och 1440 pixlars bredd: ingen horisontell överströmning, ett kontaktformulär per sida och inga rapporterade trasiga bilder.
- Startsida och kontaktformulär visuellt granskade på mobil, startsida och kontaktsida även på stor skärm.
- Mobilmenyn öppnar och navigerar till vald sida. Formulärets felmeddelande visas och ifyllda uppgifter ligger kvar vid fel.
- Inga konsolfel vid öppning av den färdigbyggda startsidan.
- Det gamla bolagsnamnet, lastbilar, budbilar och startåret 2008 finns inte i den genererade webbplatsen.
- Postadressen är borttagen från kontaktuppgifter, dokumentation och byggd webbplats.

I denna begränsade Windows-miljö stoppades det vanliga esbuild-programmets filåtkomst. Wrangler kontrollerades därför med esbuilds officiella WebAssembly-variant som tillfällig lokal verktygsersättning. Den levererade projektkoden och dess standardkommandon använder vanliga Wrangler. Verktygsersättningen behövs inte som en del av webbplatsen.

## Återstår före lansering

1. Logga in på rätt Cloudflare-konto och publicera projektet.
2. Anslut domänen bossbuss.com i Cloudflare.
3. Verifiera avsändardomänen hos Resend och ange serverhemligheten RESEND_API_KEY.
4. Verifiera verklig e-postleverans med ett eget test och granska det slutliga innehållet.

Ingen publicering, DNS-ändring eller verklig e-postleverans har utförts. Inga lösenord eller API-nycklar finns i leveransen. Ingen Lighthouse-poäng eller extern prestandamätning har genomförts.
