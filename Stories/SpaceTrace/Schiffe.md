# Space Trace – Aussehen der Raumschiffe

Verbindliche Beschreibung der beiden Raumschiffe für alle Bilder von Space Trace. Ziel: Die **Glover** und die **Hoffnung** sehen auf jedem Bild gleich aus.

**So wird das Dokument benutzt:**

- Die Abschnitte **„Prompt-Baustein“** werden **wortgleich** in die Bild-Prompts übernommen (Bildfeld `image`, `stateImages` oder `cutscene.image`). Nicht umformulieren, nicht kürzen: Gerade die wiederholte, gleiche Formulierung sorgt für ein einheitliches Aussehen.
- Ein Bild-Prompt beschreibt danach nur noch, **was in dieser Szene anders ist**: Blickrichtung, was draußen zu sehen ist, Licht, Zustand.
- Alles hier stimmt mit den Texten der Geschichte überein. Wer einen Text ändert, prüft dieses Dokument mit.
- Die Stilregeln (Farben, Licht, keine Personen) stehen weiter im Masterprompt der Geschichte (`header.imageMasterPrompt`). Dieses Dokument ergänzt ihn nur um die Schiffe.
- **Verbindlich sind die Vorlagebilder** in `vorlagen/` (`glover_aussen.jpg`, `hoffnung_aussen.jpg`, erzeugt mit `generate_picprompt.py`). Weicht ein Detail dieses Textes vom Vorlagebild ab, gilt das Bild. Jedes Bild, auf dem ein Schiff von außen (oder die Glover-Kanzel von innen) zu sehen ist, bekommt die passende Vorlage mitgeschickt (`imageRefs`/`refs`) und bezieht sich im Prompt darauf: Bei zwei Vorlagen ist die Glover „Vorlage 1“ und die Hoffnung „Vorlage 2“, bei einer Vorlage heißt sie „Vorlage 1“.
- Die Bausteine „Glover außen“ und „Hoffnung außen“ sind die Grundlage der Vorlagebilder. Eine Änderung daran lässt `generate_picprompt.py` die Vorlage neu erzeugen, darum nur bewusst ändern.

---

## 1. Die Glover

### Eckdaten (aus den Texten)

- Kleiner Ein-Personen-Transporter, gestartet vor einigen Monaten von Titan.
- Etwa **30 m lang und 10 m breit**.
- Vorne das **Cockpit**, dahinter der **fensterlose Laderaum** (etwa 10 × 6 m) mit den Medikamentenbehältern.
- Die **Schleuse** liegt an der Rückwand des Laderaums, daneben die Halterung für den Raumanzug.
- **Steuerdüsen** geben einen kurzen, bläulichen Schub. **Landestützen**, außerdem eine **Antennenbuchse unter dem Cockpit** (dort wird später die Datenkupplung eingesteckt).
- Zustand: technisch defekt, Sender tot, Antenne intakt, Treibstoff fast leer und am Ende ganz leer.

### Außen

Schnittiger, lang gestreckter Transporter: praktisch gebaut, aber mit fließenden Linien.

- **Proportionen:** Der Frachtteil ist der Hauptteil des Schiffs. Er nimmt etwa **vier Fünftel der Länge** ein. Die Bugsektion mit dem Cockpit sitzt vorne davor, niedriger als der Frachtteil, etwa ein Fünftel der Länge.
- **Bug:** eine flache, nach vorne spitz zulaufende Bugsektion mit **einer einzigen großen, nahtlos gewölbten Panoramascheibe** als Cockpitfenster. Sie zieht sich über die ganze Front und ein Stück über die Seiten, ohne Streben, nur von einem schmalen dunklen Rahmen eingefasst.
- **Rumpf:** dahinter ein großer, fensterloser Frachtteil mit abgeschrägten Kanten und fließenden Übergängen, der nach hinten leicht ansteigt, mit Wartungsklappen. Innen der Laderaum (etwa 10 × 6 m).
- **Heck:** zwei Triebwerksdüsen in einer flachen Verkleidung, darüber die Außenluke der Schleuse.
- **Steuerdüsen:** kleine Düsenblöcke an den vier Rumpfecken.
- **Unterseite:** drei einklappbare Landestützen, unter dem Cockpit eine kleine runde Antennenbuchse. Oben eine kurze Stabantenne.
- **Farbe und Material:** hellgrauer, abgenutzter Lack mit Kratzern, Rußspuren und abgeplatzten Stellen. Gelbe Warnmarkierungen an Luke, Düsen und Landestützen. Am Bug seitlich der Schriftzug „GLOVER“ in Schablonenschrift.
- **Licht:** zwei kleine Positionslichter (eins rot, eins grün) an den Rumpfseiten, sonst dunkel.
- Frühere Fassung (bis 25.10.2026): gedrungener Frachter mit Glaskuppel aus mehreren Scheiben. Auf Wunsch des Autors abgelöst.

**Prompt-Baustein „Glover außen“**

> die Glover, ein kleiner Ein-Personen-Transporter, etwa 30 Meter lang und 10 Meter breit, mit schnittiger, lang gestreckter Form und fließenden Linien: vorne eine flache, nach vorne spitz zulaufende Bugsektion, niedriger als der Rumpf und etwa ein Fünftel der Schiffslänge, mit einer einzigen großen, nahtlos gewölbten Panoramascheibe als Cockpitfenster, die sich über die ganze Front und ein Stück über die Seiten zieht, ohne Streben, nur von einem schmalen dunklen Rahmen eingefasst; dahinter ein großer, fensterloser Frachtteil mit abgeschrägten Kanten, der etwa vier Fünftel der Länge einnimmt und nach hinten leicht ansteigt, mit Wartungsklappen; am Heck zwei Triebwerksdüsen in einer flachen Verkleidung und die Außenluke einer Schleuse, kleine Steuerdüsen an den vier Rumpfecken, drei einklappbare Landestützen; hellgrauer, abgenutzter Lack mit Kratzern und Rußspuren, gelbe Warnmarkierungen, seitlich am Bug der Schablonenschriftzug „GLOVER“, je ein rotes und ein grünes Positionslicht

### Das Cockpit (kritisch)

Das Cockpit erscheint in vielen Bildern: als Ort in vier Zuständen und in den Nahaufnahmen der drei Konsolen. Es muss **immer derselbe Raum** sein.

**Raum:** eng, gerade Platz für einen Piloten. Niedrige Decke mit einer Schalterleiste über dem Fenster. Wände aus grau lackierten Metallpaneelen mit Gebrauchsspuren. Ein einzelner Pilotensitz mit abgewetztem, dunkelgrauem Polster und Gurten, die lose herabhängen.

**Fenster:** **eine einzige große, gewölbte Panoramascheibe** ohne Streben, mit schmalem dunklem Rahmen und feinen Kratzern im Glas, genau wie auf dem Vorlagebild der Glover. Durch diese Scheibe sieht man in jedem Zustand die Szene draußen.

**Konsole:** eine durchgehende, schräge Konsole direkt unter dem Fenster, in **drei feste Bereiche** geteilt, immer in dieser Reihenfolge von links nach rechts:

1. **Links: Status und Treibstoff.** Mehrere kleine Statusanzeigen in Blauweiß. **Oben links** ein kleiner Bildschirm mit einem **kurzen roten Treibstoffbalken**, der einzige rote Fleck auf der Konsole.
2. **Mitte: Navigation.** Ein quadratischer, dunkler Bildschirm in Radar-Optik (ohne kreisenden Suchstrahl), darauf gegebenenfalls ein kleiner weißer Punkt. Rundherum kleine Bedientasten und Schalter, eine davon deutlich mit „AUTOPILOT“ beschriftet.
3. **Rechts: manuelle Steuerung.** Ein ergonomischer Steuerknüppel mit mehreren Tasten, fest in die Konsole eingebaut, daneben kleine Statusanzeigen und Schalter.

**Linke Seitenwand: Kommunikationskonsole.** Seitlich eingebaut, neben dem Sitz: ein kompaktes Display, Bedientasten, Drehregler, Statusleuchten und ein integrierter Lautsprecher. Die Statusleuchten sind dunkel oder rot (der Sender ist tot).

**Licht:** dämmrig. Die Konsole leuchtet kühl blauweiß, dazu der rote Treibstoffbalken. Sonst kommt das Licht nur von draußen durchs Fenster.

**Cockpit-Bilder im Spiel:** Maßgeblich ist allein das Vorlagebild `glover_cockpit.jpg` (Baustein unten). Alle vier Cockpit-Bilder bekommen es als **Vorlage 1** und zeigen das Cockpit **unverändert**, also derselbe Bildausschnitt, dieselbe Kameraposition, Scheibe, Rahmen, Wandverkleidung, Konsolenkante und dasselbe Licht. Der Vordergrund ist in allen Zuständen identisch. Die Prompts beschreiben das Cockpit **nicht** noch einmal in Worten (keine doppelte Information), sondern nur, was durch die Scheibe zu sehen ist. Das Startbild (leeres All) ist die Vorlage selbst.

**Prompt-Baustein „Glover-Kanzel von innen“** (beschreibt das Vorlagebild `glover_cockpit.jpg`. Das Bild ist das frühere Cockpit-Spielbild aus Git (Commit 487fba4, `pictures/pic_00013.jpg`) und wurde vom Autor als Vorlage gewählt. Es hat keine eigene Bild-Vorlage und keinen Zuschnitt und wird nur neu erzeugt, wenn sich dieser Baustein ändert.)

> Blick vom Pilotensitz im Cockpit der Glover geradeaus nach vorne: Eine einzige große, breite Panoramascheibe mit abgerundeten Ecken nimmt fast das ganze Bild ein, eingefasst von einem schmalen, hellgrau metallisch schimmernden Rahmen. Dahinter leeres, tiefschwarzes Weltall mit vielen kleinen Sternen, keine Planeten und keine Himmelskörper. Auf dem Glas feine Kratzer und eine schwache, kühle Spiegelung. An den Seiten und oben dunkle Wandverkleidung des Cockpits, am unteren Bildrand nur angedeutet die Oberkante einer dunklen Konsole mit einem kleinen, flachen Gerät in der Mitte. Dämmriges, kühles Licht. Keine Hände, keine Person

Jeder Cockpit-Prompt beginnt mit „Übernimm das Cockpit von Vorlage 1 vollständig und unverändert … Ändere nur, was durch die Scheibe zu sehen ist:“. Ist draußen die Hoffnung zu sehen, kommt `hoffnung_aussen.jpg` als Vorlage 2 dazu und wird ebenfalls nicht noch einmal beschrieben. Durch die Scheibe zu sehen ist:

| Zustand (`location`) | Blick durchs Fenster |
|---|---|
| `space` (Start) | leeres, tiefschwarzes Weltall mit Sternen, keine Planeten, keine auffälligen Himmelskörper |
| `byHope` | in der Ferne die ganze Hoffnung als stillstehendes Rad (siehe Baustein „Hoffnung außen“), klein bis mittelgroß im Fenster, Antrieb aus |
| `approach` | aus nächster Nähe die Stirnseite der Nabe mit der offenen Hangarbucht und der Landeplattform (siehe „Hangarbucht von außen“) |
| `hangar` | das Innere des Hangars im roten Notlicht, grüne Leitlichter am Boden (siehe „Hangar“) |

**Nahaufnahmen der Konsolen** zeigen jeweils einen der drei Bereiche bzw. die Seitenkonsole aus nächster Nähe. Sie beginnen mit „Nahaufnahme im Cockpit der Glover:“ und passen in Farben, Material und Licht zum Vorlagebild `glover_cockpit.jpg` (noch nicht angeglichen, siehe Abschnitt 3). Im unscharfen Hintergrund darf ein Stück des Panoramafensters zu sehen sein.

### Laderaum und Schleuse

- Fensterloser Raum, etwa 10 × 6 m, niedrige Decke, grau lackierte Metallwände wie im Cockpit, Bodenschienen mit Zurrösen.
- Die Transportbehälter mit den Medikamenten stehen ordentlich verzurrt in einer Reihe, mit kleinen grünen Kontrollleuchten.
- **An der Rückwand** die runde Innentür der Schleuse mit gelben Warnstreifen, **daneben** die Wandhalterung für den Raumanzug.
- Licht: kalte Deckenleuchten, dazu die grünen Kontrollleuchten der Behälter.

**Prompt-Baustein „Glover-Laderaum“**

> der fensterlose Laderaum der Glover, etwa 10 mal 6 Meter, mit niedriger Decke, grau lackierten, abgenutzten Metallwänden und Bodenschienen mit Zurrösen; in einer Reihe ordentlich verzurrte Transportbehälter mit kleinen grünen Kontrollleuchten; an der Rückwand die runde Innentür einer Schleuse mit gelben Warnstreifen, daneben eine Wandhalterung für einen Raumanzug; kalte Deckenleuchten

---

## 2. Die Hoffnung

### Eckdaten (aus den Texten)

- Kolonieschiff von der **Kronos-Werft auf Titan**, gestartet vor 26 Jahren, seit 21 Jahren verschollen. An Bord waren 340 Kolonisten und 8 Besatzungsmitglieder.
- **Über zwei Kilometer groß.** Sie sendet keine Kennung, hat keinen Funkverkehr, und nirgendwo brennt ein Fenster.
- **Zwei riesige Ringe mit einer gemeinsamen Achse**, die sich nicht mehr bewegen. Dazwischen unzählige Streben und Verbindungselemente, im Zentrum eine Antriebseinheit.
- **Ring A** ist der Wohnring (versiegelt, „Rotation aus“), **Ring B** der Kälteschlafring. Erreichbar ist er über **Speichen**: enge, 300 m lange Schächte mit Leitern.
- Die Ringe sind **mit Narben von Mikrometeoriten übersät**, die Panzerung ist zerkratzt.
- An der **Stirnseite der Nabe** liegt eine offene, **rechteckige Hangarbucht**, aus der trübes Licht fällt. Davor ragt eine **Landeplattform** ins All, gesäumt von schwach blinkenden Leitlichtern. Man erreicht sie, indem man der Achse bis zur Nabe folgt.
- Die **Hauptantenne ist zerstört**, und **beide Shuttles fehlen**.

### Aufbau: ein einziges Rad

Die Hoffnung hat **nur ein drehbares Teil**: ein großes Rad. Es besteht aus **zwei Ringen in derselben Ebene**, einem inneren und einem äußeren, um eine gemeinsame Nabe. Beide Ringe sind fest miteinander verbunden und drehen sich darum immer gemeinsam, wie ein Wagenrad. Bei gleicher Drehung ist die Schwerkraft im äußeren Ring größer als im inneren.

**Jetzt dreht sich nichts mehr.** Das Rad steht still, an Bord herrscht Schwerelosigkeit. **Der Antrieb ist aus**: Die Hoffnung treibt antriebslos durchs All, keine Düse leuchtet, kein Abgasstrahl, nirgendwo Glut.

```
   Vorderansicht (Blick auf die Nabe)          Seitenansicht

          ______________                            |
       .-'  Ring A außen  '-.                       |   Ring A
     /    ___________       \                       |
    |   /  Ring B innen \    |              [Hangar]=[Nabe]=[Antrieb, aus]
    |  |    \  |  /      |   |                      |
    |  |  -- [Nabe] --   |   |                      |   Ring B
    |  |    /  |  \      |   |                      |
    |   \___________/    |                          |
     \     Speichen       /
       '-.____________.-'
```

1. **Nabe** in der Mitte des Rades: ein dicker, zylindrischer Block auf der Drehachse, der nach vorne und hinten aus der Radebene herausragt.
   - **Vorne** an ihrer flachen Stirnseite liegt die rechteckige Hangarbucht mit der vorgelagerten Landeplattform.
   - **Hinten** sitzt die **Antriebseinheit**: ein massiger Zylinder mit Kühlrippen und Düsenringen, **kalt, dunkel und abgeschaltet**.
   - **Innen** liegen die Brücke (mit großen Sichtfenstern auf das Rad), der Hangar, der Maschinenraum und der lange, gerade Korridor.
2. **Ring B, innen** (Kälteschlaf): etwa **800 m Durchmesser**. Ihn erreicht man von der Nabe aus über Speichen von etwa 300 m Länge, eine davon ist „Speiche B“.
3. **Ring A, außen** (Wohnring, versiegelt): etwa **2 km Durchmesser**, in derselben Ebene wie Ring B. Hier hatte die wache Besatzung die stärkere Schwerkraft.
4. **Speichen und Streben:** Gerade Speichen führen von der Nabe zum inneren Ring. Zwischen innerem und äußerem Ring laufen unzählige Streben und Verbindungselemente, die beide Ringe zu einem starren Rad verbinden.
5. An der Nabe steht ein **abgerissener Mast**, die Reste der zerstörten Hauptantenne.

**Größenverhältnis:** Neben der Hoffnung ist die Glover (30 m) ein winziger Punkt. Der äußere Ring ist fast siebzigmal so groß wie die Glover lang ist.

### Außen: Material, Farbe, Licht

- **Material und Farbe:** dunkelgraue, matte Panzerplatten mit hellen Kratzern und Narben von Mikrometeoriten, an den Ringen besonders dicht. Die Ringe haben Reihen kleiner, dunkler Fenster.
- **Licht:** Alles ist dunkel. Die einzige Ausnahme sind die schwach blinkenden grünen Leitlichter an der Landeplattform vor der Hangarbucht und das trübe Licht aus der Bucht.
- **Zustand:** Das Rad steht still, der Antrieb ist aus. Keine Düse brennt, kein Triebwerksstrahl, keine Bewegungsspuren. Das Schiff treibt einfach im Raum.

**Prompt-Baustein „Hoffnung außen“**

> die Hoffnung, ein gigantisches Kolonieraumschiff von über zwei Kilometern Durchmesser in Form eines einzigen, flachen Rades wie ein Wagenrad: Es gibt nur dieses eine Rad in einer einzigen Ebene, keinen weiteren Ring in einer anderen Richtung. Der Radkranz besteht aus einem äußeren Ring von etwa zwei Kilometern Durchmesser und einem inneren Ring von etwa 800 Metern Durchmesser, der innere Ring liegt innerhalb des äußeren, beide flach in derselben Ebene, starr verbunden durch unzählige Streben und Verbindungselemente; vom inneren Ring führen gerade Speichen zur Nabe in der Radmitte; die Nabe ist ein dicker Zylinder auf der Drehachse, vorne mit einer rechteckigen Hangaröffnung an der flachen Stirnseite, hinten mit einer massigen, abgeschalteten Antriebseinheit, an der Nabe ein abgerissener Antennenmast; das Rad steht still, der Antrieb ist aus, keine Düse leuchtet, kein Triebwerksstrahl, das Schiff treibt antriebslos im All; dunkelgraue, matte Panzerplatten, übersät mit hellen Kratzern und Narben von Mikrometeoriten, in keinem Fenster brennt Licht

**Prompt-Baustein „Hangarbucht von außen“** (für den Anflug entlang der Achse)

> die flache Stirnseite der zylindrischen Nabe der Hoffnung aus nächster Nähe, im Hintergrund unscharf die Speichen und der stillstehende innere Ring: dunkelgraue, zerkratzte Panzerplatten mit Narben von Mikrometeoriten, in der Mitte eine große, offene, rechteckige Hangarbucht, aus der trübes rotes Licht fällt, davor eine ins All ragende Landeplattform, gesäumt von schwach blinkenden grünen Leitlichtern

### Innen: gemeinsame Gestaltung

Alle Innenräume der Hoffnung teilen dieselbe Gestaltung, damit sie als **ein** Schiff erkennbar sind:

- **Material:** Wandpaneele aus graublau lackiertem Metall, abgenutzt, mit Nieten und Wartungsklappen. Rohre und Kabelstränge an Decke und Wänden. Hinweisschilder in nüchterner Schablonenschrift.
- **Zustand:** seit 21 Jahren ohne Besatzung. Staub, Kälte, Schwerelosigkeit (das Rad steht still). **Kein Eis, kein Frost, kein Raureif und keine schwebenden Gegenstände** (Entscheidung des Autors), in Bildern und Texten.
- **Schwerkraft:** keine, weil die Ringe stillstehen. Lose Gurte und Gegenstände schweben.

| Raum | Typisches Licht | Feste Merkmale |
|---|---|---|
| Hangar | rotes Notlicht, grüne Leitlichter am Boden | riesig, Wände verlieren sich im Dunkel, leere Andockplätze, Landeplattform mit „HOFFNUNG · ANDOCKBUCHT 3“, geschlossenes Hangartor (ca. 50 m, gelb-schwarze Warnstreifen), hinten eine schwere Schleusentür mit grünem Bedienfeld |
| Korridor | kalte, weiße Deckenleuchten, teils flackernd | lang und gerade, führt vom Hangar tief ins Innere der Nabe, Wegweiser „Brücke“, „Maschinenraum“, „Speiche B“ |
| Speiche B | nur der Lichtkegel einer Helmlampe | enger runder Schacht von der Nabe zum inneren Ring, etwa 300 m, Leiter an der Wand, Rohre |
| Brücke | dunkel, nur zwei Konsolen leuchten | in der Nabe, halbrund, acht leere Sitze, alle zu den Konsolen ausgerichtet, treibende Gurte, großes Sichtfenster mit Blick ins leere All |
| Maschinenraum | warmes, orangefarbenes Licht (einziger warmer Raum) | eng, kompakter Notreaktor (kühlschrankgroß) mit Strichkalender, mit Klebeband befestigte Kabel, festgeschnallter Schlafsack, Werkbank |
| Schlafring (innerer Ring B) | kaltes blaues Licht, grüne und vereinzelt rote Kapsellichter | der Boden krümmt sich in der Ferne nach oben (Innenseite des Rings), lange Reihen von Kälteschlafkapseln mit beschlagenen Sichtfenstern, feiner Nebel |

**Hangar mit der Glover:** Die Glover steht klein und verloren mitten auf der Landeplattform, ausgerichtet an den grünen Leitlichtern, mit ausgefahrenen Landestützen. Für sie wird der Baustein „Glover außen“ verwendet.

---

## 3. Stand der Bild-Prompts

Stand: 24.10.2026. Diese Bilder nutzen die Vorlagen und beziehen sich im Prompt darauf:

| Bild | Vorlagen |
|---|---|
| Cockpit Glover: Start (ist die Vorlage selbst), Hangar | Glover-Cockpit |
| Cockpit Glover (`byHope`, `approach`) | Glover-Cockpit, Hoffnung |
| Zwischensequenz „Flug zu unbekanntem Objekt“ | Glover |
| Zwischensequenz „Mit der manuellen Steuerung heranfliegen“ | Glover, Hoffnung |
| Zwischensequenz „Auf der Landeplattform landen“ | Glover |
| Hangar | Glover |
| Datenkupplung (Unterseite der Glover) | Glover |
| Zwischensequenz „Notruf senden“ (nur die Hoffnung, die Glover steht unsichtbar im Hangar) | Hoffnung |

Die Brücke der Hoffnung hat auf Wunsch des Autors keine Vorlage: Ihr Fenster zeigt nur leeres Weltall, passend zum Text.

Noch offen, bewusst nicht geändert (Innenansichten):

- **Navigationskonsole, manuelle Steuerung, Kommunikationskonsole:** Diese Nahaufnahmen beschreiben ihr Cockpit jeweils etwas anders (Farben, Material, Licht). Sie könnten den Angaben aus Abschnitt „Das Cockpit“ folgen.
- **Laderaum:** Der Prompt ist sehr knapp und enthält Tippfehler („Laderaumen“, „Raaum“, „spezifiert“). Der Baustein „Glover-Laderaum“ könnte ihn ersetzen.
