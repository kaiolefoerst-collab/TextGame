# Technisches Spielkonzept: Elementbasiertes Erzähl- und Erkundungsspiel

## 1. Zweck dieses Dokuments

Dieses Dokument beschreibt die technische und spielmechanische Grundlage eines erzählerischen Erkundungsspiels. Es soll später als Ausgangspunkt für die Implementierung durch eine KI, etwa ChatGPT oder Claude Code, dienen.

Die konkrete Handlung des Spiels ist ausdrücklich nicht Bestandteil dieses Dokuments. Spielsystem und Geschichteninhalt sollen getrennt bleiben, damit mit derselben Engine mehrere Geschichten erzeugt und gespielt werden können.

Der erste Prototyp soll als Textadventure funktionieren. Wenn sich Geschichte und Spielprinzip bewähren, soll dieselbe Datenbasis später für ein grafisches Adventure genutzt werden können.

## 2. Grundidee

Der Spieler erkundet eine Welt und findet nach und nach Fragmente einer oder mehrerer Geschichten. Die Geschichten können in anderen Zeitebenen liegen. Erkenntnisse aus einer Ebene können Elemente einer anderen Ebene verändern oder dort neue Elemente sichtbar machen.

Der Spieler soll keine schweren Rätsel lösen. Der Schwerpunkt liegt auf:

- Erkundung,
- dem Entdecken von Informationen,
- dem schrittweisen Verstehen einer Geschichte,
- neuen Deutungen bereits bekannter Fakten,
- erzählerischen Wendungen,
- der Anwendung gewonnenen Wissens auf die erkundbare Welt.

Die Geschichte darf innerhalb kleiner Bereiche frei erkundet werden. Im Hintergrund kann sie jedoch eine verdeckte Makrostruktur besitzen. Bestimmte Erkenntnisse öffnen weitere Bereiche und Fragmente. Diese Makrostruktur muss nicht chronologisch sein; sie kann thematisch nach Personen, Orten, Gerüchten, Konflikten oder Geheimnissen gegliedert werden.

Zu unterscheiden sind:

- **Chronologie:** Reihenfolge, in der die Ereignisse tatsächlich geschahen.
- **Fundreihenfolge:** Reihenfolge, in der der Spieler Fragmente entdeckt.
- **Enthüllungsstruktur:** Reihenfolge, in der größere Zusammenhänge verständlich werden sollen.

## 3. Zentrales Prinzip: Alles ist ein Element

Das zentrale Datenobjekt des Spiels ist das **Element**. Ein großer Satz miteinander verknüpfter Elemente beschreibt die Welt und erzählt die vollständige Geschichte.

Mögliche Elementtypen sind beispielsweise:

- Raum oder Außenbereich,
- Person,
- Gegenstand,
- Tür oder Weg,
- Dokument,
- Ereignis,
- Gerücht,
- Geschichte,
- Thema,
- Beobachtung,
- Konflikt.

Elementtypen dienen der Darstellung und können später typabhängige Eigenschaften erhalten. Sie sind aber keine unterschiedlichen technischen Grundobjekte.

Auch der Spieler kann als Element modelliert werden. Gegenstände im Inventar befinden sich dann räumlich im Element `player`.

## 4. Zwei Arten von Elementen

### 4.1 Physische Elemente

Physische Elemente können in einer erkundbaren Welt vorkommen, angezeigt und benutzt werden. Beispiele sind ein Zimmer, ein Schreibtisch, ein Zettel, eine Person oder eine Tür.

### 4.2 Reine Story-Elemente

Reine Story-Elemente existieren nicht physisch in der Welt. Sie erscheinen nur in Wissensdarstellungen wie Logbuch und Gerüchtekarte. Beispiele sind ein Gerücht, eine Geschichte oder ein vergangenes Ereignis.

Ein Story-Element kann durch Trigger den Zustand eines physischen Elements verändern. Beispielsweise kann eine Erkenntnis über einen versteckten Eintrag dafür sorgen, dass das bereits vorhandene physische Element `bucheintrag` sichtbar wird.

Eine Person und eine Geschichte über diese Person sind getrennte Elemente. Beispiel:

- physisches Element `jaeger`, Typ `person`,
- Story-Element `geschichte_jaeger`, Typ `story`.

Beide können logisch miteinander verknüpft sein.

## 5. Räumliche Beziehung: `locatedIn`

Ein physisches Element kann höchstens genau ein `locatedIn` besitzen. Damit entsteht eine eindeutige räumliche Struktur.

Beispiel:

```text
Zettel → befindet sich in → Schreibtisch
Schreibtisch → befindet sich in → Arbeitszimmer
Arbeitszimmer → befindet sich in → Jagdhaus
```

`locatedIn` beschreibt ausschließlich den aktuellen räumlichen Ort. Die Eigenschaft kann durch einen Effekt geändert werden.

Beispiel: Ein Schlüssel befindet sich anfangs in einer Schublade. Wird er aufgenommen, ändert ein Trigger sein `locatedIn` auf `player`.

Indirekte räumliche Beziehungen werden nicht redundant gespeichert. Wenn der Zettel im Schreibtisch und der Schreibtisch im Arbeitszimmer liegt, kann die Engine ableiten, dass sich der Zettel mittelbar im Arbeitszimmer befindet.

## 6. Logische Beziehung: `partOf`

Ein Element kann beliebig viele `partOf`-Einträge besitzen. Daraus entsteht ein komplexes logisches Netzwerk.

Beispiele:

```text
Jäger → ist Teil von → Geschichte über den Jäger
Jäger → ist Teil von → Werwolfgerücht
Kratzspuren → sind Teil von → Werwolfgerücht
```

Auch wechselseitige oder zyklische `partOf`-Beziehungen sind zulässig. Das logische Modell ist kein Hierarchiebaum.

Alle in Logbuch und Gerüchtekarte dargestellten Verbindungen werden aus `partOf` erzeugt. Es gibt derzeit keine separate Liste erzählerischer Verbindungen.

Komplexe Beziehungen können selbst als Elemente modelliert werden. Beispiel:

```text
Element: Täuschung der Dorfbewohner
partOf:
- Jäger
- Dorfbewohner
- Werwolfgerücht
```

`partOf` ist dynamisch. Der Startzustand enthält nur die anfangs gültigen beziehungsweise bekannten Zuordnungen. Trigger können `partOf`-Einträge hinzufügen, entfernen oder ersetzen. Dadurch können Twists das dargestellte Beziehungsnetz tatsächlich verändern.

## 7. Fragmente

Ein Element kann mehrere Fragmente besitzen. Ein Fragment besteht aus:

- **Fakt:** die gefundene Information; der Fakt bleibt unverändert,
- **Vermutung:** die vom Programm vorgegebene aktuelle Interpretation des Fakts; sie darf sich ändern.

Beispiel:

```text
Fakt:
An mehreren Bäumen befinden sich tiefe Kratzspuren.

Erste Vermutung:
Die Spuren könnten von einem Werwolf stammen.

Spätere Vermutung:
Der Jäger hat die Spuren künstlich erzeugt, um die Bewohner zu täuschen.
```

Der Spieler formuliert die Vermutung nicht selbst. Das Spiel aktualisiert sie aufgrund neuer Funde und Zustandsänderungen. Dadurch können bereits bekannte Fakten eine neue Bedeutung erhalten und erzählerische Wendungen erzeugen.

## 8. Ebenen

Die Engine darf nicht fest auf genau eine Gegenwart und eine Vergangenheit programmiert werden. Sie soll eine beliebige Anzahl von Ebenen unterstützen.

Eine Ebene kann eine Zeit, eine Wirklichkeit, eine Erinnerung oder eine andere erzählerische Perspektive repräsentieren. Eine Geschichte und eine Ebene sind unterschiedliche Konzepte:

- Eine Ebene beschreibt, wann oder in welcher Wirklichkeit etwas existiert.
- Eine Geschichte ist ein logischer Zusammenhang aus Elementen.

Eine Geschichte kann mehrere Ebenen umfassen. In einer Ebene können mehrere Geschichten liegen.

Elemente enthalten eine Liste ihrer Ebenen. Die Eigenschaft `playable` wird nicht benötigt. Ob ein Spieler eine Ebene direkt betreten kann, ergibt sich aus vorhandenen Elementen, Übergängen, Triggern und Bedingungen.

Der Spieler darf theoretisch Ebenen wechseln. Für die Engine unterscheidet sich ein Ebenenwechsel grundsätzlich nicht von einem anderen Übergang. Im ersten Prototyp kann der Spieler trotzdem zunächst nur eine Ebene direkt erkunden.

Erkenntnisse können zwischen beliebigen Ebenen wirken:

- Ein Fund in Ebene A macht ein Element in Ebene B sichtbar.
- Ein Fund in Ebene B ändert die Vermutung zu einem Fragment aus Ebene A.
- Erkenntnisse aus mehreren Ebenen können gemeinsam einen Effekt auslösen.

## 9. Sichtbarkeit und Entdeckung

Alle Elemente besitzen einen Startzustand. Trigger anderer Elemente können diesen Zustand dynamisch verändern.

Ein verborgenes physisches Element existiert bereits mit unverändertem `locatedIn`. Wird es aufgrund einer Erkenntnis sichtbar, wird es nicht neu erzeugt und nicht bewegt. Nur sein Zustand ändert sich.

Beispiel:

```text
Zettel befindet sich von Anfang an im Schreibtisch.
Startzustand: hidden
Nach einer Erkenntnis: visible
locatedIn bleibt: Schreibtisch
```

Wird der Spieler an einem anderen Ort über den Zettel informiert, kann er ihn dort noch nicht benutzen. Er muss zum Schreibtisch zurückkehren. Sichtbarkeit hebt die räumliche Erreichbarkeit nicht auf.

Die endgültigen Namen und die vollständige Liste der Zustandsfelder sind noch nicht festgelegt. Voraussichtlich werden mindestens physische Sichtbarkeit, Entdeckung und weitere typabhängige Zustände benötigt.

## 10. Navigation durch Elemente

Nicht nur klassische Räume, sondern auch enthaltene Elemente können zum aktuellen Betrachtungsfokus werden.

Beispiel:

```text
Aktuell: Arbeitszimmer
→ Schreibtisch benutzen
Aktuell: Schreibtisch
→ Zettel benutzen
Aktuell: Zettel
```

Der Rückweg wird automatisch aus `locatedIn` erzeugt, wenn kein ausdrückliches Übergangselement vorhanden ist.

Beispiele für die Darstellung:

- vom Zettel zum Schreibtisch: „Zettel zurücklegen“,
- vom Schreibtisch zum Arbeitszimmer: „Schreibtisch schließen“,
- ansonsten als Fallback: „Zurück zu: Arbeitszimmer“.

Eine passende Rückkehr-Beschriftung kann am Element hinterlegt werden. Der Rückweg verändert `locatedIn` nicht, sofern das Element nicht tatsächlich bewegt wird. Er ändert nur den aktuellen Betrachtungsfokus des Spielers.

Türen und Wege sind eigenständige Elemente. Wenn ein ausdrückliches Übergangselement vorhanden ist, erfolgt die Navigation über dessen Trigger. `locatedIn` dient dann nicht als zusätzlicher Ausgang.

Da jedes Element höchstens ein `locatedIn` besitzt, ist der automatische Rückweg eindeutig.

## 11. Einzige bewusste Spieleraktion: Element benutzen

Die Bedienung soll besonders einfach und für Mobilgeräte geeignet sein. Der Spieler besitzt nur eine universelle Aktion:

> **Element benutzen**

Die Oberfläche zeigt die aktuell sichtbaren und erreichbaren Elemente. Ein Antippen ruft immer denselben Engine-Befehl auf:

```text
use(elementId)
```

Was „benutzen“ bedeutet, bestimmt das Element:

- einen Schreibtisch untersuchen,
- einen Zettel lesen,
- mit einer Person sprechen,
- eine Tür durchqueren,
- einen Gegenstand aufnehmen,
- eine Erinnerung betreten,
- einen Raum oder ein Behältnis schließen.

Es gibt keine separate Auswahl von Verben und zunächst keine manuelle Kombination von Inventargegenständen. Besitzt der Spieler einen passenden Schlüssel und benutzt eine Tür, kann der Tür-Trigger den Schlüssel automatisch berücksichtigen.

## 12. Trigger, Bedingungen und Effekte

Jedes benutzbare Element besitzt einen oder mehrere `onUse`-Trigger. Beim Benutzen werden alle Trigger des Elements geprüft. Alle Trigger, deren Bedingungen erfüllt sind, werden ausgeführt.

Trigger sollen deklarativ in JSON beschrieben werden. Es soll kein beliebiger JavaScript- oder C++-Code in den Geschichtendaten stehen. Das erleichtert Validierung, KI-Generierung und spätere Portierung.

Mögliche Bedingungen sind beispielsweise:

- Element besitzt einen bestimmten Zustand,
- Fragment wurde gefunden,
- Element befindet sich beim Spieler,
- Element befindet sich an einem bestimmten Ort,
- Element besitzt einen bestimmten `partOf`-Eintrag,
- Spieler befindet sich in einer bestimmten Ebene,
- Trigger ist aktiviert.

Mögliche Effekte sind beispielsweise:

- Element sichtbar oder verborgen machen,
- Fragment entdecken,
- Vermutung ändern,
- `partOf` hinzufügen, entfernen oder ersetzen,
- `locatedIn` ändern,
- aktuellen Betrachtungsfokus ändern,
- Ebene wechseln,
- Text anzeigen,
- eigenen oder fremden Trigger aktivieren oder deaktivieren.

Ein Trigger muss nicht durch eine besondere `once`-Eigenschaft einmalig gemacht werden. Ein Effekt des Triggers kann dem Element seine eigene Triggermöglichkeit nehmen, indem er den Trigger deaktiviert. Umgekehrt können Trigger später wieder aktiviert werden.

Noch nicht festgelegt ist, ob ein während einer Benutzung neu aktivierter Trigger sofort oder erst bei der nächsten Benutzung geprüft wird.

## 13. Informationsfluss zwischen Ebenen

Wissen verändert, was in einer anderen Ebene erkennbar oder benutzbar ist.

Beispiel:

1. In einer vergangenen Geschichte wird das Fragment gefunden: „Der wesentliche Eintrag steht auf Seite 3, Absatz 2.“
2. Das physische Element `bucheintrag_seite_3_absatz_2` existiert bereits in der Gegenwart und befindet sich im Buch.
3. Sein Startzustand ist `hidden`.
4. Der Fragmentfund löst einen Effekt aus und setzt das Element auf `visible`.
5. Der Spieler muss in der Gegenwart zum Buch zurückkehren.
6. Dort kann er den nun sichtbaren Eintrag benutzen.

Die Erkenntnis findet den Eintrag nicht automatisch und teleportiert ihn nicht zum Spieler. Sie verändert lediglich seinen Zustand.

## 14. Drei Hauptdarstellungen

Alle Darstellungen werden aus demselben Elementbestand und dem aktuellen Spielzustand erzeugt.

### 14.1 Aktuelle Welt

Diese Ansicht beschreibt aus Sicht des Spielers:

- den aktuellen Betrachtungsfokus,
- die aktuelle Ebene,
- die sichtbaren und räumlich erreichbaren Elemente,
- Veränderungen seit früheren Besuchen,
- automatisch erzeugte Rückwege,
- ausdrückliche Übergangselemente.

Jedes dargestellte Element ist antippbar. Antippen bedeutet immer `use(elementId)`.

### 14.2 Logbuch

Das Logbuch zeigt das erworbene Wissen geordnet und lesbar:

- bekannte Elemente,
- gefundene Fragmente,
- Fakten,
- aktuelle Vermutungen,
- Untersuchungsstände,
- Zugehörigkeit zu Ebenen und Geschichten,
- aktuell offene oder erneut relevant gewordene Orte.

Orte können aus dem Zustand ihrer enthaltenen Elemente Hinweise erzeugen, beispielsweise:

- „Ich habe den Eindruck, dass ich im Dorf noch etwas übersehen habe.“
- „Im Dorf scheint es im Moment nichts mehr zu entdecken zu geben.“
- „Durch meine neuen Erkenntnisse sollte ich mich dort erneut umsehen.“

Ein vorläufig abgeschlossener Ort kann später wieder relevant werden.

### 14.3 Gerüchtekarte

Die Gerüchtekarte visualisiert das aktuelle logische Netzwerk. Ihre Knoten sind bekannte Elemente, ihre Kanten werden aus dem aktuellen `partOf`-Zustand erzeugt.

Wenn Trigger `partOf` verändern, verändert sich die Gerüchtekarte automatisch. Dadurch können neue Erkenntnisse und Twists vorhandene Zusammenhänge neu ordnen.

## 15. Textdarstellung und spätere Grafik

Der erste Prototyp wird textbasiert. Aus dem aktuellen Element, seinen sichtbaren direkt enthaltenen Elementen, dem Spielzustand und dem Wissen des Spielers kann eine Beschreibung erzeugt werden.

Eine KI darf diese Daten sprachlich und atmosphärisch formulieren. Sie darf jedoch keine neuen Spielfakten, untersuchbaren Gegenstände, Personen oder Übergänge erfinden.

Grundregel:

> Die Engine bestimmt die Wahrheit und den Zustand der Welt. Die KI formuliert nur deren Darstellung.

Für eine spätere grafische Version bleibt die Spiellogik unverändert:

- sichtbares Element → sichtbares und anklickbares Objekt,
- verborgenes Element → nicht dargestellt oder nicht interaktiv,
- Element benutzen → Antippen oder Anklicken,
- `locatedIn` → räumliche Platzierung,
- Zustandsänderung → anderes Modell, Bild oder Animation,
- aktueller Betrachtungsfokus → Szene, Kamera oder Nahansicht.

## 16. Trennung von Definition und Spielstand

Die Geschichtendaten beschreiben Startzustände, mögliche Trigger, Bedingungen und Effekte. Der Spielstand speichert die Veränderungen eines konkreten Durchlaufs.

Ein Spielstand benötigt voraussichtlich mindestens:

- aktuellen Betrachtungsfokus,
- aktuelle Ebene,
- aktuelle Zustände veränderter Elemente,
- aktuelles `locatedIn` bewegter Elemente,
- aktuelle `partOf`-Listen,
- gefundene Fragmente,
- aktuelle Vermutungen,
- aktivierte und deaktivierte Trigger.

Die genaue Trennung zwischen statischen Definitionen und dynamischen Zuständen ist bei der Implementierung festzulegen.

## 17. Vorläufige JSON-Struktur eines Elements

Die folgende Struktur ist ein Arbeitsentwurf und noch kein endgültiges Schema:

```json
{
  "id": "desk_01",
  "type": "furniture",
  "name": "Alter Schreibtisch",
  "physical": true,
  "timeLayers": ["present"],
  "locatedIn": "study_01",
  "partOf": ["story_hunter"],
  "exitLabel": "Schreibtisch schließen",
  "initialState": {
    "visibility": "visible",
    "status": "unsearched"
  },
  "fragments": [],
  "triggers": {
    "onUse": [
      {
        "id": "discover_paper",
        "enabled": true,
        "conditions": [
          {
            "type": "elementState",
            "elementId": "paper_01",
            "property": "visibility",
            "value": "hidden"
          }
        ],
        "effects": [
          {
            "type": "setElementState",
            "elementId": "paper_01",
            "property": "visibility",
            "value": "visible"
          },
          {
            "type": "disableTrigger",
            "elementId": "desk_01",
            "triggerId": "discover_paper"
          },
          {
            "type": "showText",
            "text": "In einer Schublade findest du ein zerknittertes Blatt Papier."
          }
        ]
      }
    ]
  }
}
```

Beispiel eines dynamischen `partOf`-Effekts:

```json
{
  "type": "replacePartOf",
  "elementId": "scratch_marks",
  "remove": "werewolf_rumor",
  "add": "hunters_deception"
}
```

Beispiel einer Bewegung:

```json
{
  "type": "setLocatedIn",
  "elementId": "key_01",
  "value": "player"
}
```

## 18. Noch offene Systementscheidungen

Die folgenden Punkte sind bewusst noch nicht abschließend definiert:

1. endgültige Liste und Benennung der Zustandsfelder,
2. genaue Definition von „bekannt“, „sichtbar“, „gefunden“ und „untersucht“, soweit diese Unterscheidungen praktisch benötigt werden,
3. Verhalten von Triggern, die während derselben Benutzung weitere Trigger aktivieren,
4. Reihenfolge und Konfliktauflösung, wenn mehrere gleichzeitig ausgeführte Trigger dasselbe Feld ändern,
5. vollständiges JSON-Schema mit Validierung,
6. genaue Regeln für automatische Texte und KI-Prompts,
7. konkrete Darstellung umfangreicher Logbücher und Gerüchtenetze,
8. automatische Ermittlung, ob ein Ort vorläufig vollständig untersucht ist,
9. Speicherformat und Versionierung von Geschichten und Spielständen,
10. automatischer Test auf unerreichbare Elemente, Sackgassen und zirkuläre Voraussetzungen,
11. technische Architektur und Programmiersprache des ersten Prototyps.

Diese Fragen sollten anhand einer kleinen Testgeschichte entschieden werden. Ein abstraktes Vorabmodell bis ins letzte Detail würde unnötig tief in mögliche Sonderfälle führen.

## 19. Empfohlener nächster Entwicklungsschritt

Als nächster Schritt sollte eine sehr kleine Testgeschichte erstellt werden, die gezielt alle Kernmechaniken enthält:

- wenige räumlich verschachtelte Elemente,
- mindestens ein verborgenes Element,
- ein physisches und ein reines Story-Element,
- ein Fragment mit Fakt und später veränderter Vermutung,
- dynamische Ergänzung und Änderung von `partOf`,
- ein Fund in einer Ebene, der ein Element in einer anderen Ebene sichtbar macht,
- ein bewegliches Element mit geändertem `locatedIn`,
- eine Tür oder ein anderes ausdrückliches Übergangselement,
- Logbuch und Gerüchtekarte,
- ein kleiner Twist,
- ein eindeutig erreichbarer Abschluss.

Erst anhand dieses vertikalen Mini-Prototyps sollte das endgültige JSON-Schema festgeschrieben und die Engine implementiert werden.
