# Testgeschichte „Die verfluchte Mühle“ – Elementkatalog, Version 3

> **Spoilerhinweis:** Dieses Dokument enthält die vollständige Wahrheit der Geschichte und ist als Autoren- und Implementierungsgrundlage gedacht. Nicht lesen, wenn der Fall zunächst selbst gespielt werden soll.

## 1. Zweck und Status

Dieses Dokument überführt die Testgeschichte „Die überflutete Mühle“ in einen vollständigen Satz von Elementen. Es enthält Elemente der Gegenwart und der Vergangenheit sowie Startzustände, Fragmente, logische Zugehörigkeiten, feste Darstellungstexte und Triggerwirkungen.

Version 3 berücksichtigt die Erkenntnisse aus zwei vollständigen Spieldurchläufen und folgt den `Autorenregeln.md`:

- keine dynamische KI während des Spiels,
- alle spielrelevanten und atmosphärischen Texte werden vorab gespeichert,
- Logbuch nur für die Gegenwart,
- Gerüchtelog nur für die Vergangenheit,
- sofort vollständig sichtbare Einträge statt Untermenüs,
- Widersprüche und offene Fragen als temporäre Story-Elemente,
- eindeutige und reihenfolgeunabhängige Zielhinweise,
- gespeicherte Wiederholungstexte für bereits benutzte Elemente,
- ausdrückliche Untersuchungszustände für gegenwärtige Orte.

Es ist noch kein valides JSON und kein endgültiges Datenschema. Die YAML-ähnlichen Elementblöcke sind bewusst gut lesbar gehalten und können später mechanisch in JSON überführt werden.

## 2. Spielziel

Der Spieler erreicht in der Gegenwart ein verlassenes Dorf mit einer zerstörten Mühle und einem verfallenen Sägewerk. Sobald er das Gelände betritt, schließt sich dichter Nebel um den Ort. Der Weg hinaus führt ihn immer wieder zum Dorfplatz zurück.

Der Ort gibt den Spieler erst frei, wenn er die Geschichte der Überschwemmung verstanden hat. Dafür muss er die heute noch vorhandenen Elemente untersuchen. Funde in der Gegenwart erzeugen Elemente und Fragmente der Vergangenheit. Diese verändern wiederum die Sichtbarkeit anderer Elemente der Gegenwart.

Es gibt keine schweren Rätsel und nur eine bewusste Spieleraktion: **Element benutzen**.

## 3. Kanonische Wahrheit für Autoren und Engine

Vor etwa 40 Jahren lebte der Müller Hannes Voss mit seiner 16-jährigen Tochter Clara in der Wassermühle unterhalb des Dorfes. Oberhalb des Dorfes betrieb Richard Brandt ein Sägewerk. Damit seine Turbine bei niedrigem Wasserstand mehr Leistung erhielt, ließ Brandt heimlich einen Entlastungskanal verschließen.

Clara beobachtete die Arbeiten und notierte ihre Beobachtung im Geschäftsbuch ihres Vaters. Als ein starkes Unwetter aufzog, stellte sie Brandt zur Rede. Brandt nahm ihr eine Zeichnung des Kanals ab und sperrte sie im Lagerraum des Sägewerks ein.

Hannes erkannte die Gefahr und öffnete das Notwehr der Mühle. Das Wasser wurde dadurch vom Dorf weg und durch seine eigene Mühle geleitet. Die Mühle wurde zerstört, das Dorf aber gerettet. Danach befreite Hannes Clara. Brandt bedrohte beide. Hannes schickte Clara heimlich zu ihrer Tante und ließ das Dorf glauben, sie sei bei der Flut gestorben. Er nahm auch die öffentliche Schuld an der Überschwemmung auf sich, um Clara zu schützen.

Zwölf Jahre später kehrte Clara nachts zur Ruine zurück und versteckte einen Brief mit der Wahrheit. Ein Dorfbewohner sah sie und hielt sie für Claras Geist. Daraus entstand das Gerücht von der Frau in der Mühle.

## 4. Ebenen

```yaml
layers:
  - id: present
    name: Gegenwart
    description: Der verfluchte Ort, den der Spieler direkt erkundet.

  - id: flood_night
    name: Die Nacht der Überschwemmung
    description: Die zentrale vergangene Zeitebene vor etwa 40 Jahren.

  - id: clara_return
    name: Claras Rückkehr
    description: Claras heimliche Rückkehr zwölf Jahre nach der Flut.
```

Die Vergangenheit wird in dieser Testfassung nur indirekt durch Funde rekonstruiert. Die Datenstruktur erlaubt später trotzdem einen direkten Ebenenwechsel.

## 5. Übersicht des räumlichen Netzes der Gegenwart

```text
Verfluchtes Gelände
├── Dorfplatz
│   ├── Gedenkstein
│   ├── Weg zur Mühle
│   ├── Weg zum Sägewerk
│   └── Weg aus dem Dorf
├── Mühlenruine
│   ├── Schreibtisch
│   │   └── Geschäftsbuch
│   │       └── Claras Eintrag [anfangs verborgen]
│   ├── Notwehrmechanik
│   ├── Lose Wandbohle
│   │   └── Claras Brief [anfangs verborgen]
│   └── Weg zurück zum Dorfplatz
└── Sägewerksruine
    ├── Büro
    │   └── Wartungsnotiz
    ├── Alter Lagerraum
    │   ├── Türverriegelung
    │   └── Claras Haarband
    ├── Verschlossener Entlastungskanal
    └── Weg zurück zum Dorfplatz
```

## 6. Elementkonvention in diesem Dokument

Jeder Elementblock verwendet nach Bedarf diese Felder:

```yaml
id: eindeutige_id
name: Anzeigename
type: Elementtyp
physical: true | false
layers: [Ebene, ...]
locatedIn: genau_eine_element_id | null
initialState: Startzustände
initialPartOf: anfängliche logische Zuordnungen
fragments: Fakten und Vermutungen
onUse: Bedingungen und Effekte
```

`locatedIn` ist immer höchstens ein Wert. `partOf` kann beliebig viele Werte annehmen und wird im Spiel dynamisch erweitert, entfernt oder ersetzt.

---

# Teil A – Gegenwart: physische Elemente

## A01 – Spieler

```yaml
id: player
name: Ich
type: player
physical: true
layers: [present]
locatedIn: village_square_present
initialState:
  visible: false
initialPartOf: []
```

Der Spieler ist selbst ein Element. Aufgenommene Gegenstände erhalten `locatedIn: player`.

## A02 – Verfluchtes Gelände

```yaml
id: cursed_site_present
name: Verlassenes Mühlendorf
type: area
physical: true
layers: [present]
locatedIn: null
initialState:
  visible: true
  curseActive: true
  investigation: open
initialPartOf: [case_cursed_mill]
presentation:
  firstView: Dichter Nebel umschließt das verlassene Gelände und verhindert jede Sicht auf die Umgebung.
  repeatView: Der Nebel liegt weiterhin wie eine geschlossene Wand um das Gelände.
fragments:
  - id: f_site_fog
    fact: Dichter Nebel umschließt das Gelände und verhindert die Abreise.
    assumption: Der Ort scheint mich festzuhalten, bis ich etwas verstanden habe.
```

## A03 – Dorfplatz

```yaml
id: village_square_present
name: Verlassener Dorfplatz
type: room
physical: true
layers: [present]
locatedIn: cursed_site_present
exitLabel: Gelände verlassen
initialState:
  visible: true
  investigation: open
initialPartOf: [case_cursed_mill]
presentation:
  firstView: Du stehst auf einem kleinen, verlassenen Dorfplatz. Feuchte Pflastersteine verschwinden am Rand im dichten Nebel. In der Mitte steht ein alter Gedenkstein.
  repeatView: Du stehst wieder auf dem feuchten Dorfplatz. Der Nebel liegt unbeweglich zwischen den verlassenen Häusern.
fragments:
  - id: f_square_abandoned
    fact: Der Dorfplatz ist verlassen; nur der alte Gedenkstein wird noch gepflegt.
    assumption: Die Überschwemmung scheint das zentrale Ereignis dieses Ortes gewesen zu sein.
```

## A04 – Gedenkstein

```yaml
id: memorial_stone_present
name: Gedenkstein der Flut
type: object
physical: true
layers: [present]
locatedIn: village_square_present
initialState:
  visible: true
  investigation: open
initialPartOf: [official_flood_story]
presentation:
  firstUse: Du wischst Moos von der verwitterten Inschrift. Unter dem offiziellen Text wurde später ein weiterer Satz eingeritzt.
  repeatUse: Die Inschrift und der später eingeritzte Satz sind bereits vollständig lesbar.
  contentText: |
    Zum Gedenken an Clara Voss, die in der großen Flut ihr Leben verlor.
    Verursacht durch die schuldhafte Bedienung des Mühlenwehrs durch ihren Vater Hannes Voss.

    Später eingeritzt:
    „Die Wahrheit liegt noch immer im Wasser.“
fragments:
  - id: f_memorial_text
    fact: Der Stein nennt Clara Voss als Opfer und Hannes Voss als Verursacher der Flut.
    assumption: Der Müller verursachte die Katastrophe, bei der seine Tochter starb.
  - id: f_memorial_scratched_sentence
    fact: Unter der Inschrift steht eingeritzt: „Die Wahrheit liegt noch immer im Wasser.“
    assumption: Jemand zweifelte an der offiziellen Darstellung der Flut.
onUse:
  - id: use_memorial_first
    enabled: true
    effects:
      - discoverFragment: f_memorial_text
      - discoverFragment: f_memorial_scratched_sentence
      - revealElement: official_flood_story
      - revealElement: hannes_guilt_rumor
      - revealElement: clara_death_story
      - addPartOf: [hannes_past, hannes_guilt_rumor]
      - addPartOf: [clara_past, clara_death_story]
      - setElementState: [memorial_stone_present, investigation, complete]
      - disableSelfTrigger: use_memorial_first
```

## A05 – Weg zur Mühle

```yaml
id: path_to_mill
name: Weg zur Mühle
type: door
physical: true
layers: [present]
locatedIn: village_square_present
initialState:
  visible: true
initialPartOf: []
onUse:
  - id: enter_mill
    enabled: true
    effects:
      - setCurrentElement: mill_ruin_present
```

## A06 – Weg zum Sägewerk

```yaml
id: path_to_sawmill
name: Weg zum Sägewerk
type: door
physical: true
layers: [present]
locatedIn: village_square_present
initialState:
  visible: true
initialPartOf: []
onUse:
  - id: enter_sawmill
    enabled: true
    effects:
      - setCurrentElement: sawmill_ruin_present
```

## A07 – Weg aus dem Dorf

```yaml
id: road_out_present
name: Weg aus dem Dorf
type: door
physical: true
layers: [present]
locatedIn: village_square_present
initialState:
  visible: true
  blockedByCurse: true
initialPartOf: [curse_of_place]
presentation:
  blockedText: Der Weg verschwindet im Nebel. Wenige Schritte später stehst du auf dem Dorfplatz.
  exitText: Du folgst dem Weg aus dem Dorf. Der Gedenkstein verschwindet hinter dir, und der Ort zieht dich nicht zurück. Die Geschichte der verfluchten Mühle ist abgeschlossen.
onUse:
  - id: exit_blocked
    enabled: true
    conditions:
      - stateEquals: [cursed_site_present, curseActive, true]
    effects:
      - showTextFrom: presentation.blockedText
      - setCurrentElement: village_square_present

  - id: exit_released
    enabled: true
    conditions:
      - stateEquals: [cursed_site_present, curseActive, false]
    effects:
      - showTextFrom: presentation.exitText
      - finishGame: true
```

## A08 – Mühlenruine

```yaml
id: mill_ruin_present
name: Ruine der Wassermühle
type: room
physical: true
layers: [present]
locatedIn: cursed_site_present
initialState:
  visible: true
  investigation: open
initialPartOf: [case_cursed_mill, history_mill]
presentation:
  firstView: Der Weg endet an einer halb eingestürzten Wassermühle. Die stärksten Schäden befinden sich auf der flussabgewandten Seite. Es wirkt, als sei eine gewaltige Wassermenge mitten durch die Mühle geströmt.
  repeatView: Du stehst wieder zwischen den eingestürzten Balken der alten Mühle.
  openLeadView: An der Wand neben dem Schreibtisch sitzt die dritte Bohle deutlich lockerer als die übrigen.
  currentHint: null
fragments:
  - id: f_mill_damage
    fact: Die stärksten Schäden liegen auf der flussabgewandten Seite der Mühle.
    assumption: Die Mühle wurde von einer gewaltigen Wassermenge durchströmt.
```

## A09 – Schreibtisch

```yaml
id: mill_desk_present
name: Vermoderter Schreibtisch
type: furniture
physical: true
layers: [present]
locatedIn: mill_ruin_present
exitLabel: Schreibtisch schließen
initialState:
  visible: true
  investigation: open
initialPartOf: [history_mill, hannes_past]
presentation:
  firstView: Im geöffneten Schreibtisch liegen zerfallene Rechnungen, verrostete Schreibfedern und ein dickes altes Geschäftsbuch.
  completeView: Im Schreibtisch scheint es derzeit nichts Weiteres zu entdecken zu geben.
onUse:
  - id: focus_desk
    enabled: true
    effects:
      - setCurrentElement: mill_desk_present
```

## A10 – Geschäftsbuch

```yaml
id: business_ledger_present
name: Altes Geschäftsbuch
type: document
physical: true
layers: [present]
locatedIn: mill_desk_present
exitLabel: Buch zuklappen
initialState:
  visible: true
  investigation: open
initialPartOf: [history_mill, hannes_past]
presentation:
  firstUse: Die ersten Seiten enthalten gewöhnliche Einträge über Mehl, Getreide und Lieferungen. Die letzten Seiten sind durch Schlamm und Feuchtigkeit miteinander verklebt.
  blockedUse: Ohne einen konkreten Hinweis kannst du zwischen den beschädigten Zeilen nichts Auffälliges erkennen.
  openLeadUse: Auf der letzten beschriebenen Seite befindet sich eine Notiz in einer deutlich jüngeren Handschrift. Unter ihr stehen die Initialen „C. V.“.
  completeUse: Claras Eintrag ist bereits vollständig gelesen. Im Buch gibt es derzeit nichts Weiteres zu entdecken.
fragments:
  - id: f_ledger_general
    fact: Das Geschäftsbuch gehörte Hannes Voss. Die letzten Seiten sind verschmutzt und teilweise verklebt.
    assumption: Vielleicht enthält das Buch noch Informationen über die Zeit vor der Flut.
onUse:
  - id: open_ledger
    enabled: true
    effects:
      - discoverFragment: f_ledger_general
      - setCurrentElement: business_ledger_present
```

## A11 – Claras Eintrag im Geschäftsbuch

```yaml
id: clara_ledger_entry_present
name: Claras Eintrag auf der letzten Seite
type: document_entry
physical: true
layers: [present]
locatedIn: business_ledger_present
exitLabel: Eintrag schließen
initialState:
  visible: false
  investigation: open
initialPartOf: []
presentation:
  firstUse: Claras verblasste Notiz auf der letzten beschriebenen Seite wird vollständig lesbar.
  repeatUse: Der Eintrag beschreibt die Blockade des Kanals und Claras Absicht, Brandt zur Rede zu stellen. Weitere Informationen enthält er nicht.
  contentText: |
    Brandts Männer haben den Entlastungskanal mit Balken und Steinen verschlossen.
    Das Wasser läuft deshalb nur noch durch seine Turbine.
    Vater sagt, dass dies bei starkem Regen gefährlich ist.

    Über dem Wald stehen dunkle Wolken. Ich gehe zum Sägewerk und verlange von Herrn Brandt, dass er den Kanal öffnen lässt.

    C. V.
fragments:
  - id: f_clara_saw_channel_closed
    fact: Clara notierte, dass Brandts Arbeiter den Entlastungskanal mit Balken und Steinen verschlossen.
    assumption: Brandt könnte die spätere Flutgefahr selbst verursacht haben.
  - id: f_clara_confront_brandt
    fact: Clara schrieb, sie werde Brandt bei aufziehendem Regen zur Rede stellen.
    assumption: Clara ging in der Flutnacht freiwillig zum Sägewerk.
onUse:
  - id: read_clara_entry
    enabled: true
    effects:
      - discoverFragment: f_clara_saw_channel_closed
      - discoverFragment: f_clara_confront_brandt
      - revealElement: illegal_channel_closure
      - revealElement: confrontation_at_sawmill
      - addPartOf: [richard_brandt_past, illegal_channel_closure]
      - addPartOf: [clara_past, illegal_channel_closure]
      - addPartOf: [clara_past, confrontation_at_sawmill]
      - revealElement: old_store_room_present
      - revealElement: question_clara_at_sawmill
      - setElementState: [sawmill_ruin_present, investigation, open]
      - setElementState: [sawmill_ruin_present, currentHint, Claras Spur führt zum alten Lagerraum im Sägewerk. Du kannst das Sägewerk untersuchen.]
      - setElementState: [business_ledger_present, investigation, complete]
      - setElementState: [mill_ruin_present, currentHint, null]
      - setElementState: [clara_ledger_entry_present, investigation, complete]
      - disableSelfTrigger: read_clara_entry

  - id: complete_mill_if_gate_already_examined
    enabled: true
    conditions:
      - elementStateEquals: [emergency_gate_mechanism_present, investigation, complete]
    effects:
      - setElementState: [mill_ruin_present, investigation, complete]
      - setElementState: [mill_ruin_present, currentHint, null]
      - disableSelfTrigger: complete_mill_if_gate_already_examined
```

## A12 – Notwehrmechanik

```yaml
id: emergency_gate_mechanism_present
name: Mechanik des alten Notwehrs
type: mechanism
physical: true
layers: [present]
locatedIn: mill_ruin_present
initialState:
  visible: true
  investigation: open
initialPartOf: [history_mill]
presentation:
  firstUse: Du entfernst Schlamm von der Mechanik. Der Stellhebel steht in äußerster Position. Die Markierungen zeigen, dass das Notwehr vollständig geöffnet wurde und das Wasser vom Dorf weg durch die Mühle leitete.
  repeatUse: Die Mechanik bestätigt weiterhin die vollständige, offenbar bewusste Öffnung des Notwehrs. Weitere Informationen gibt sie nicht preis.
fragments:
  - id: f_gate_direction
    fact: Die Mechanik wurde vollständig geöffnet. In dieser Stellung leitete sie Wasser durch die Mühle und vom Dorf weg.
    assumption: Wer das Wehr öffnete, nahm die Zerstörung der Mühle bewusst in Kauf, um das Dorf zu schützen.
onUse:
  - id: inspect_gate
    enabled: true
    effects:
      - discoverFragment: f_gate_direction
      - revealElement: emergency_opening
      - addPartOf: [hannes_past, emergency_opening]
      - addPartOf: [history_mill, emergency_opening]
      - setElementState: [emergency_gate_mechanism_present, investigation, complete]
      - disableSelfTrigger: inspect_gate

  - id: reveal_hannes_contradiction_if_unresolved
    enabled: true
    conditions:
      - elementStateEquals: [corrected_flood_cause_story, visible, false]
    effects:
      - revealElement: contradiction_hannes_guilt
      - addPartOf: [hannes_past, contradiction_hannes_guilt]
      - addPartOf: [official_flood_story, contradiction_hannes_guilt]
      - disableSelfTrigger: reveal_hannes_contradiction_if_unresolved

  - id: reveal_silence_question_after_gate
    enabled: true
    conditions:
      - elementStateEquals: [corrected_flood_cause_story, visible, true]
    effects:
      - revealElement: question_hannes_silence
      - addPartOf: [hannes_past, question_hannes_silence]
      - addPartOf: [official_flood_story, question_hannes_silence]
      - disableSelfTrigger: reveal_silence_question_after_gate

  - id: complete_mill_if_ledger_already_read
    enabled: true
    conditions:
      - elementStateEquals: [clara_ledger_entry_present, investigation, complete]
    effects:
      - setElementState: [mill_ruin_present, investigation, complete]
      - setElementState: [mill_ruin_present, currentHint, null]
      - disableSelfTrigger: complete_mill_if_ledger_already_read
```

## A13 – Lose Wandbohle

```yaml
id: loose_wall_board_present
name: Lose Wandbohle
type: object
physical: true
layers: [present]
locatedIn: mill_ruin_present
initialState:
  visible: false
  investigation: open
initialPartOf: []
presentation:
  firstView: Die dritte Wandbohle neben Hannes’ Schreibtisch sitzt deutlich lockerer als die übrigen.
  firstUse: Hinter der Bohle befindet sich ein schmaler Hohlraum mit einem in Tuch gewickelten Brief.
  repeatUse: Der Hohlraum hinter der dritten Bohle ist bereits geöffnet.
onUse:
  - id: open_wall_board
    enabled: true
    effects:
      - revealElement: clara_letter_present
      - setCurrentElement: loose_wall_board_present
      - disableSelfTrigger: open_wall_board
```

## A14 – Claras Brief

```yaml
id: clara_letter_present
name: Claras versteckter Brief
type: document
physical: true
layers: [present]
locatedIn: loose_wall_board_present
exitLabel: Brief zurücklegen
initialState:
  visible: false
  investigation: open
initialPartOf: []
presentation:
  firstUse: Du faltest den trockenen, spröden Brief auseinander. Er ist mit „Clara Voss“ unterzeichnet.
  repeatUse: Claras Brief enthält die vollständige Erklärung der Flutnacht und ihrer späteren Rückkehr.
  contentText: |
    Für denjenigen, der noch nach der Wahrheit sucht.

    Ich habe die Flut überlebt.

    Richard Brandt sperrte mich im Lagerraum ein, nachdem ich ihn wegen des verschlossenen Kanals zur Rede gestellt hatte. Mein Vater öffnete das Notwehr und leitete das Wasser durch unsere Mühle. Er verlor alles, aber das Dorf wurde gerettet. Danach holte er mich aus dem Sägewerk.

    Brandt drohte, mich zum Schweigen zu bringen. Mein Vater schickte mich zu meiner Tante und ließ alle glauben, ich sei gestorben. Er nahm die Schuld an der Flut auf sich, damit niemand nach mir suchte.

    Zwölf Jahre sind vergangen. Ich bin zur Mühle gekommen, um diesen Brief zu hinterlassen. Auf der letzten beschriebenen Seite von Vaters Geschäftsbuch steht, was ich vor dem Unwetter gesehen habe.

    Vielleicht wird jemand verstehen, was mein Vater für das Dorf und für mich getan hat.

    Clara Voss
fragments:
  - id: f_clara_survived
    fact: Der Brief wurde von Clara zwölf Jahre nach der Flut geschrieben.
    assumption: Clara starb nicht bei der Überschwemmung.
  - id: f_hannes_rescued_clara
    fact: Clara schreibt, ihr Vater habe sie aus Brandts Lagerraum befreit.
    assumption: Hannes verschwieg ihr Überleben, um sie vor Brandt zu schützen.
  - id: f_letter_ledger_hint
    fact: Clara verweist auf ihren Eintrag auf der letzten beschriebenen Seite des Geschäftsbuchs.
    assumption: Das alte Geschäftsbuch enthält den entscheidenden Hinweis auf die Ursache der Flut.
onUse:
  - id: read_clara_letter
    enabled: true
    effects:
      - discoverFragment: f_clara_survived
      - discoverFragment: f_hannes_rescued_clara
      - discoverFragment: f_letter_ledger_hint
      - revealElement: clara_survived_story
      - revealElement: rescue_of_clara
      - revealElement: protective_silence
      - revealElement: clara_secret_return
      - hideElement: contradiction_clara_death
      - hideElement: question_clara_at_sawmill
      - hideElement: question_hannes_silence
      - hideElement: clara_death_story
      - hideElement: ghost_woman_rumor
      - addPartOf: [clara_past, clara_survived_story]
      - addPartOf: [hannes_past, rescue_of_clara]
      - addPartOf: [clara_past, rescue_of_clara]
      - addPartOf: [hannes_past, protective_silence]
      - addPartOf: [clara_past, protective_silence]
      - addPartOf: [clara_past, clara_secret_return]
      - removePartOf: [clara_past, clara_death_story]
      - revealElement: clara_ledger_entry_present
      - setElementState: [clara_letter_present, investigation, complete]
      - setElementState: [mill_ruin_present, investigation, complete]
      - setElementState: [mill_ruin_present, currentHint, null]
      - disableSelfTrigger: read_clara_letter
```

## A15 – Sägewerksruine

```yaml
id: sawmill_ruin_present
name: Ruine des Sägewerks
type: room
physical: true
layers: [present]
locatedIn: cursed_site_present
initialState:
  visible: true
  investigation: open
  currentHint: null
initialPartOf: [case_cursed_mill, history_sawmill]
presentation:
  firstView: Das Hauptgebäude des alten Sägewerks ist teilweise eingestürzt. Hinter ihm verläuft ein vollständig verschlossener Entlastungskanal.
  repeatView: Du stehst wieder zwischen den verfallenen Gebäudeteilen des Sägewerks.
  openLeadView: Im eingestürzten Seitenflügel befindet sich der Zugang zu einem alten Lagerraum.
```

## A16 – Büro des Sägewerks

```yaml
id: sawmill_office_present
name: Verfallenes Büro
type: room
physical: true
layers: [present]
locatedIn: sawmill_ruin_present
exitLabel: Büro verlassen
initialState:
  visible: true
  investigation: open
initialPartOf: [history_sawmill, richard_brandt_past]
presentation:
  firstView: Im verfallenen Büro liegt unter einer losen Glasplatte eine noch lesbare Wartungsnotiz mit dem Stempel des Sägewerks.
  completeView: Im Büro scheint es derzeit nichts Weiteres zu entdecken zu geben.
```

## A17 – Wartungsnotiz

```yaml
id: maintenance_note_present
name: Verblasste Wartungsnotiz
type: document
physical: true
layers: [present]
locatedIn: sawmill_office_present
exitLabel: Notiz zurücklegen
initialState:
  visible: true
  investigation: open
initialPartOf: [history_sawmill]
presentation:
  firstUse: Die Notiz trägt Brandts Unterschrift. Eine Bleistiftnotiz eines Arbeiters erwähnt das Mädchen von der Mühle und Hannes’ Geschäftsbuch.
  repeatUse: Brandt ordnete die Blockade selbst an. Das Mädchen von der Mühle schrieb ihre Beobachtung in Hannes’ Buch. Weitere Informationen enthält die Notiz nicht.
  contentText: |
    Arbeitsanweisung

    Den Entlastungskanal dauerhaft mit Balken und Bruchsteinen verschließen.
    Der gesamte Wasserlauf ist der Turbine zuzuführen.

    Richard Brandt

    Bleistiftnotiz eines Arbeiters:
    „Das Mädchen von der Mühle hat uns gesehen. Sie sagte, sie hätte alles in Hannes’ Buch geschrieben.“
fragments:
  - id: f_maintenance_order
    fact: Eine Arbeitsanweisung Brandts ordnet an, den Entlastungskanal dauerhaft zu blockieren.
    assumption: Die Blockade war kein Unfall und geschah auf Brandts ausdrücklichen Befehl.
  - id: f_worker_ledger_reference
    fact: Ein Arbeiter vermerkte, dass „das Mädchen von der Mühle“ alles gesehen und in Hannes' Buch geschrieben habe.
    assumption: Im Geschäftsbuch der Mühle muss ein verborgener Eintrag Claras existieren.
onUse:
  - id: read_maintenance_note
    enabled: true
    effects:
      - discoverFragment: f_maintenance_order
      - discoverFragment: f_worker_ledger_reference
      - revealElement: illegal_channel_closure
      - addPartOf: [richard_brandt_past, illegal_channel_closure]
      - addPartOf: [sawmill_workers_past, illegal_channel_closure]
      - revealElement: clara_ledger_entry_present
      - hideElement: contradiction_hannes_guilt
      - hideElement: hannes_guilt_rumor
      - revealElement: corrected_flood_cause_story
      - removePartOf: [hannes_past, hannes_guilt_rumor]
      - addPartOf: [richard_brandt_past, corrected_flood_cause_story]
      - addPartOf: [illegal_channel_closure, corrected_flood_cause_story]
      - setElementState: [business_ledger_present, investigation, open]
      - setElementState: [mill_ruin_present, investigation, open]
      - setElementState: [mill_ruin_present, currentHint, Im Geschäftsbuch auf Hannes’ Schreibtisch befindet sich ein Eintrag des Mädchens von der Mühle. Du kannst die Mühle untersuchen.]
      - setElementState: [maintenance_note_present, investigation, complete]
      - setElementState: [sawmill_office_present, investigation, complete]
      - disableSelfTrigger: read_maintenance_note

  - id: reveal_silence_question_after_brandt_evidence
    enabled: true
    conditions:
      - elementStateEquals: [emergency_opening, visible, true]
    effects:
      - revealElement: question_hannes_silence
      - addPartOf: [hannes_past, question_hannes_silence]
      - addPartOf: [official_flood_story, question_hannes_silence]
      - disableSelfTrigger: reveal_silence_question_after_brandt_evidence
```

## A18 – Alter Lagerraum

```yaml
id: old_store_room_present
name: Alter Lagerraum
type: room
physical: true
layers: [present]
locatedIn: sawmill_ruin_present
exitLabel: Lagerraum verlassen
initialState:
  visible: false
  investigation: open
initialPartOf: [history_sawmill]
presentation:
  firstView: Der kleine Lagerraum besitzt kein Fenster. Seine schwere Tür kann nur von außen verriegelt werden. Zwischen verrotteten Säcken liegt ein verblasstes Haarband.
  completeView: Haarband, Verriegelung und Kratzspuren sind untersucht. Im Lagerraum gibt es derzeit nichts Weiteres zu entdecken.
```

## A19 – Türverriegelung des Lagerraums

```yaml
id: store_room_lock_present
name: Verriegelung des Lagerraums
type: object
physical: true
layers: [present]
locatedIn: old_store_room_present
initialState:
  visible: true
  investigation: open
initialPartOf: []
presentation:
  firstUse: Die schwere Verriegelung befindet sich ausschließlich außen. Auf der Innenseite der Tür sind tiefe Kratzspuren zu erkennen.
  repeatUse: Die Verriegelung kann nur von außen bedient werden. Die Kratzspuren innen sind bereits dokumentiert.
fragments:
  - id: f_lock_outside
    fact: Die alte Tür konnte nur von außen verriegelt werden.
    assumption: Wer sich im Lagerraum befand, konnte sich nicht selbst einschließen.
  - id: f_lock_inside_scratches
    fact: Auf der Innenseite der Tür befinden sich tiefe Kratzspuren.
    assumption: Eine eingeschlossene Person versuchte, den Lagerraum zu verlassen.
onUse:
  - id: inspect_store_lock
    enabled: true
    effects:
      - discoverFragment: f_lock_outside
      - discoverFragment: f_lock_inside_scratches
      - revealElement: clara_imprisonment
      - addPartOf: [richard_brandt_past, clara_imprisonment]
      - addPartOf: [clara_past, clara_imprisonment]
      - hideElement: question_clara_at_sawmill
      - setElementState: [store_room_lock_present, investigation, complete]
      - setElementState: [sawmill_ruin_present, currentHint, null]
      - disableSelfTrigger: inspect_store_lock

  - id: complete_sawmill_after_lock
    enabled: true
    conditions:
      - elementStateEquals: [clara_ribbon_present, investigation, complete]
    effects:
      - setElementState: [old_store_room_present, investigation, complete]
      - setElementState: [sawmill_ruin_present, investigation, complete]
      - setElementState: [sawmill_ruin_present, currentHint, null]
      - disableSelfTrigger: complete_sawmill_after_lock
```

## A20 – Claras Haarband

```yaml
id: clara_ribbon_present
name: Verblasstes Haarband
type: object
physical: true
layers: [present]
locatedIn: old_store_room_present
initialState:
  visible: true
  investigation: open
initialPartOf: []
presentation:
  firstUse: In den Saum sind die Initialen „C. V.“ eingestickt. Auf der Rückseite befindet sich eine handschriftliche Notiz.
  repeatUse: Das Haarband gehörte Clara. Der Hinweis auf der Rückseite nennt eindeutig das Versteck in der Mühle.
  contentText: „Wenn ich zur Mühle zurückkomme: hinter der dritten Wandbohle neben Vaters Schreibtisch.“
fragments:
  - id: f_ribbon_initials
    fact: In das Band sind die Initialen „C. V.“ eingestickt.
    assumption: Clara war in der Flutnacht in diesem Lagerraum.
  - id: f_ribbon_wall_marks
    fact: Auf der Rückseite steht: „Wenn ich zur Mühle zurückkomme: hinter der dritten Wandbohle neben Vaters Schreibtisch.“
    assumption: Clara plante, später etwas an einem eindeutig bezeichneten Ort in der Mühle zu verstecken.
onUse:
  - id: inspect_ribbon
    enabled: true
    effects:
      - discoverFragment: f_ribbon_initials
      - discoverFragment: f_ribbon_wall_marks
      - addPartOf: [clara_past, clara_imprisonment]
      - revealElement: loose_wall_board_present
      - revealElement: clara_secret_return
      - revealElement: contradiction_clara_death
      - addPartOf: [clara_past, contradiction_clara_death]
      - addPartOf: [clara_death_story, contradiction_clara_death]
      - addPartOf: [clara_secret_return, contradiction_clara_death]
      - setElementState: [mill_ruin_present, investigation, open]
      - setElementState: [mill_ruin_present, currentHint, Claras Hinweis nennt ein Versteck in der Mühle hinter der dritten Wandbohle neben Hannes’ Schreibtisch. Du kannst die Mühle untersuchen.]
      - setElementState: [sawmill_ruin_present, currentHint, null]
      - setElementState: [clara_ribbon_present, investigation, complete]
      - disableSelfTrigger: inspect_ribbon

  - id: complete_sawmill_after_ribbon
    enabled: true
    conditions:
      - elementStateEquals: [store_room_lock_present, investigation, complete]
    effects:
      - setElementState: [old_store_room_present, investigation, complete]
      - setElementState: [sawmill_ruin_present, investigation, complete]
      - setElementState: [sawmill_ruin_present, currentHint, null]
      - disableSelfTrigger: complete_sawmill_after_ribbon
```

## A21 – Verschlossener Entlastungskanal

```yaml
id: blocked_relief_channel_present
name: Verschlossener Entlastungskanal
type: place
physical: true
layers: [present]
locatedIn: sawmill_ruin_present
initialState:
  visible: true
  investigation: open
initialPartOf: [history_sawmill]
presentation:
  firstUse: Passend zugeschnittene Balken und gesetzte Steine zeigen, dass der Kanal absichtlich und mit erheblichem Aufwand verschlossen wurde.
  repeatUse: Die Blockade ist eindeutig menschengemacht. Weitere Informationen sind hier derzeit nicht zu finden.
fragments:
  - id: f_channel_deliberate_block
    fact: Im Kanal stecken behauene Balken und gesetzte Steine; die Blockade wurde absichtlich gebaut.
    assumption: Der Entlastungskanal wurde gezielt unbrauchbar gemacht.
onUse:
  - id: inspect_blocked_channel
    enabled: true
    effects:
      - discoverFragment: f_channel_deliberate_block
      - revealElement: illegal_channel_closure
      - addPartOf: [blocked_relief_channel_past, illegal_channel_closure]
      - setElementState: [blocked_relief_channel_present, investigation, complete]
      - disableSelfTrigger: inspect_blocked_channel
```

## A22 – Rückweg von der Mühle

```yaml
id: path_mill_to_square
name: Weg zurück zum Dorfplatz
type: door
physical: true
layers: [present]
locatedIn: mill_ruin_present
initialState:
  visible: true
initialPartOf: []
onUse:
  - id: leave_mill
    enabled: true
    effects:
      - setCurrentElement: village_square_present
```

## A23 – Rückweg vom Sägewerk

```yaml
id: path_sawmill_to_square
name: Weg zurück zum Dorfplatz
type: door
physical: true
layers: [present]
locatedIn: sawmill_ruin_present
initialState:
  visible: true
initialPartOf: []
onUse:
  - id: leave_sawmill
    enabled: true
    effects:
      - setCurrentElement: village_square_present
```

---

# Teil B – Vergangenheit: physische Elemente

Diese Elemente existieren physisch in ihren vergangenen Ebenen. In der Testfassung werden sie nicht direkt betreten, sondern über Fragmente und Story-Elemente im Log rekonstruiert.

## B01 – Hannes Voss

```yaml
id: hannes_past
name: Hannes Voss
type: person
physical: true
layers: [flood_night]
locatedIn: mill_past
initialState:
  visible: false
initialPartOf: [history_mill, case_cursed_mill]
fragments:
  - id: f_hannes_miller
    fact: Hannes war der Müller und Claras Vater.
    assumption: Er trug als Betreiber die Verantwortung für das Wehr.
```

## B02 – Clara Voss

```yaml
id: clara_past
name: Clara Voss
type: person
physical: true
layers: [flood_night, clara_return]
locatedIn: mill_past
initialState:
  visible: false
initialPartOf: [history_mill, case_cursed_mill]
fragments:
  - id: f_clara_daughter
    fact: Clara war Hannes' 16-jährige Tochter.
    assumption: Nach der öffentlichen Darstellung starb sie bei der Flut.
```

## B03 – Richard Brandt

```yaml
id: richard_brandt_past
name: Richard Brandt
type: person
physical: true
layers: [flood_night]
locatedIn: sawmill_past
initialState:
  visible: false
initialPartOf: [history_sawmill, case_cursed_mill]
fragments:
  - id: f_brandt_owner
    fact: Brandt besaß das Sägewerk und hatte großen Einfluss im Dorf.
    assumption: Seine öffentliche Stellung machte seine Darstellung glaubwürdig.
```

## B04 – Arbeiter des Sägewerks

```yaml
id: sawmill_workers_past
name: Arbeiter des Sägewerks
type: group
physical: true
layers: [flood_night]
locatedIn: sawmill_past
initialState:
  visible: false
initialPartOf: [history_sawmill]
```

## B05 – Mühle vor der Flut

```yaml
id: mill_past
name: Wassermühle vor der Flut
type: building
physical: true
layers: [flood_night]
locatedIn: village_past
initialState:
  visible: false
initialPartOf: [history_mill]
```

## B06 – Sägewerk vor der Flut

```yaml
id: sawmill_past
name: Brandts Sägewerk
type: building
physical: true
layers: [flood_night]
locatedIn: village_past
initialState:
  visible: false
initialPartOf: [history_sawmill]
```

## B07 – Dorf vor der Flut

```yaml
id: village_past
name: Dorf vor der Überschwemmung
type: area
physical: true
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [case_cursed_mill]
```

## B08 – Entlastungskanal vor der Flut

```yaml
id: blocked_relief_channel_past
name: Entlastungskanal
type: mechanism
physical: true
layers: [flood_night]
locatedIn: sawmill_past
initialState:
  visible: false
  blocked: true
initialPartOf: [history_sawmill]
```

## B09 – Notwehr der Mühle

```yaml
id: emergency_gate_past
name: Notwehr der Mühle
type: mechanism
physical: true
layers: [flood_night]
locatedIn: mill_past
initialState:
  visible: false
  open: false
initialPartOf: [history_mill]
```

## B10 – Lagerraum des Sägewerks

```yaml
id: store_room_past
name: Lagerraum des Sägewerks
type: room
physical: true
layers: [flood_night]
locatedIn: sawmill_past
initialState:
  visible: false
  lockedFromOutside: true
initialPartOf: [history_sawmill]
```

---

# Teil C – Reine Story-Elemente

## C01 – Der Fall

```yaml
id: case_cursed_mill
name: Das Geheimnis der verfluchten Mühle
type: story
physical: false
layers: [present, flood_night, clara_return]
locatedIn: null
initialState:
  visible: true
  resolved: false
initialPartOf: []
```

## C02 – Geschichte der Mühle

```yaml
id: history_mill
name: Die Geschichte der Mühle
type: story
physical: false
layers: [present, flood_night, clara_return]
locatedIn: null
initialState:
  visible: true
initialPartOf: [case_cursed_mill, hannes_past, clara_past]
```

## C03 – Geschichte des Sägewerks

```yaml
id: history_sawmill
name: Die Geschichte des Sägewerks
type: story
physical: false
layers: [present, flood_night]
locatedIn: null
initialState:
  visible: true
initialPartOf: [case_cursed_mill, richard_brandt_past]
```

## C04 – Öffentliche Flutgeschichte

```yaml
id: official_flood_story
name: Die offizielle Geschichte der Flut
type: story
physical: false
layers: [present]
locatedIn: null
initialState:
  visible: false
initialPartOf: [case_cursed_mill]
fragments:
  - id: f_official_version
    fact: Laut Gedenkstein öffnete Hannes das Wehr falsch; Clara starb in der Mühle.
    assumption: Hannes verursachte aus Fahrlässigkeit die Katastrophe.
```

## C05 – Gerücht von Hannes' Schuld

```yaml
id: hannes_guilt_rumor
name: Der schuldige Müller
type: rumor
physical: false
layers: [present]
locatedIn: null
initialState:
  visible: false
initialPartOf: [official_flood_story]
fragments:
  - id: f_hannes_rumor
    fact: Im Dorf wurde erzählt, Hannes sei in der Flutnacht betrunken gewesen.
    assumption: Hannes habe das Wehr versehentlich geöffnet.
```

## C06 – Claras angeblicher Tod

```yaml
id: clara_death_story
name: Claras Tod in der Mühle
type: story
physical: false
layers: [present]
locatedIn: null
initialState:
  visible: false
initialPartOf: [official_flood_story, ghost_woman_rumor]
fragments:
  - id: f_clara_declared_dead
    fact: Clara wurde nach der Flut für tot erklärt; ihr Körper wurde nie gefunden.
    assumption: Sie wurde von der Flut fortgerissen.
```

## C07 – Gerücht von der Frau in der Mühle

```yaml
id: ghost_woman_rumor
name: Die Frau im Regen
type: rumor
physical: false
layers: [present, clara_return]
locatedIn: null
initialState:
  visible: true
initialPartOf: [case_cursed_mill, clara_death_story]
fragments:
  - id: f_ghost_sighting
    fact: Zwölf Jahre nach der Flut wurde nachts eine Frau in der verlassenen Mühle gesehen.
    assumption: Claras Geist kehrte zur Mühle zurück.
```

## C08 – Absichtliche Schließung des Kanals

```yaml
id: illegal_channel_closure
name: Die absichtliche Schließung des Entlastungskanals
type: event
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [history_sawmill, true_flood_cause]
fragments:
  - id: f_channel_truth
    fact: Brandt ließ den Kanal sperren, damit mehr Wasser seine Turbine antrieb.
    assumption: Brandt nahm die erhöhte Flutgefahr aus wirtschaftlichem Interesse in Kauf.
```

## C09 – Wahre Ursache der Flutgefahr

```yaml
id: true_flood_cause
name: Die wahre Ursache der Flutgefahr
type: story
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [case_cursed_mill]
fragments:
  - id: f_true_cause
    fact: Starkregen traf auf den absichtlich blockierten Entlastungskanal.
    assumption: Ohne die Blockade hätte das Wasser kontrolliert abfließen können.
```

## C10 – Claras Konfrontation mit Brandt

```yaml
id: confrontation_at_sawmill
name: Claras Konfrontation mit Brandt
type: event
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [clara_past, richard_brandt_past, history_sawmill]
```

## C11 – Claras Gefangenschaft

```yaml
id: clara_imprisonment
name: Clara im Lagerraum
type: event
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [history_sawmill]
fragments:
  - id: f_imprisonment_truth
    fact: Brandt sperrte Clara von außen im Lagerraum ein.
    assumption: Er wollte verhindern, dass sie das Dorf vor dem verschlossenen Kanal warnte.
```

## C12 – Hannes öffnet das Notwehr

```yaml
id: emergency_opening
name: Die Öffnung des Notwehrs
type: event
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [history_mill, true_rescue_story]
fragments:
  - id: f_emergency_truth
    fact: Hannes öffnete das Notwehr vollständig und leitete das Wasser durch seine eigene Mühle.
    assumption: Er opferte die Mühle bewusst, um das Dorf zu retten.
```

## C13 – Die Rettung des Dorfes

```yaml
id: true_rescue_story
name: Die Rettung des Dorfes
type: story
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [case_cursed_mill, hannes_past]
```

## C14 – Hannes befreit Clara

```yaml
id: rescue_of_clara
name: Claras Befreiung aus dem Lagerraum
type: event
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [hannes_past, clara_past, history_sawmill]
```

## C15 – Clara hat überlebt

```yaml
id: clara_survived_story
name: Clara überlebte die Flut
type: story
physical: false
layers: [flood_night, clara_return]
locatedIn: null
initialState:
  visible: false
initialPartOf: [case_cursed_mill, clara_past]
```

## C16 – Das schützende Schweigen

```yaml
id: protective_silence
name: Hannes' schützendes Schweigen
type: story
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [hannes_past, clara_past, case_cursed_mill]
fragments:
  - id: f_silence_truth
    fact: Hannes widersprach der öffentlichen Anschuldigung nicht und schickte Clara heimlich zu ihrer Tante.
    assumption: Er nahm die Schuld auf sich, damit Brandt Clara nicht finden konnte.
```

## C17 – Claras heimliche Rückkehr

```yaml
id: clara_secret_return
name: Claras heimliche Rückkehr
type: event
physical: false
layers: [clara_return]
locatedIn: null
initialState:
  visible: false
initialPartOf: [clara_past, history_mill, ghost_woman_rumor]
fragments:
  - id: f_return_truth
    fact: Clara kehrte zwölf Jahre später zurück und versteckte ihren Brief in der Mühle.
    assumption: Die vermeintliche Geistererscheinung war Clara selbst.
```

## C18 – Der Fluch des Ortes

```yaml
id: curse_of_place
name: Der Fluch des verschwiegenen Geschehens
type: story
physical: false
layers: [present]
locatedIn: null
initialState:
  visible: true
initialPartOf: [case_cursed_mill, official_flood_story]
fragments:
  - id: f_curse_meaning
    fact: Der Ort hält Besucher fest, solange die falsche öffentliche Geschichte unangetastet bleibt.
    assumption: Der Weg öffnet sich, wenn die wesentlichen Zusammenhänge erkannt wurden.
```

## C19 – Vollständige Aufklärung

```yaml
id: case_resolution
name: Die Wahrheit über die Flut
type: story
physical: false
layers: [present, flood_night, clara_return]
locatedIn: null
initialState:
  visible: false
  complete: false
initialPartOf: [case_cursed_mill]
presentation:
  heading: Die Wahrheit über die Flut
  body: Richard Brandt erzeugte durch die absichtliche Blockade des Entlastungskanals die Flutgefahr und sperrte Clara ein. Hannes opferte seine Mühle, rettete das Dorf und befreite seine Tochter. Clara überlebte. Hannes nahm die öffentliche Schuld auf sich, um sie vor Brandt zu schützen. Die vermeintliche Geistererscheinung war Claras heimliche Rückkehr zur Mühle.
  releaseText: Der Nebel über dem Weg wird dünner. Der Ort hält dich nicht länger fest.
```

## C20 – Widerspruch zu Hannes’ Schuld

```yaml
id: contradiction_hannes_guilt
name: Widerspruch: Hannes’ Schuld
type: story
physical: false
layers: [present, flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: []
presentation:
  style: contradiction
  heading: Neuer Widerspruch: Hannes’ Schuld
  body: Das Notwehr wurde vollständig geöffnet. Dadurch floss das Wasser vom Dorf weg und zerstörte Hannes’ eigene Mühle. Warum bezeichnet der Gedenkstein dies als schuldhafte Fehlbedienung?
  openQuestion: Wollte Hannes die Flut verursachen – oder hat er das Dorf geschützt?
```

Dieses Element wird durch die Untersuchung des Notwehrs sichtbar. Sobald Brandts Anweisung zur Kanalsperre bekannt ist, wird es verborgen und durch `corrected_flood_cause_story` ersetzt.

## C21 – Korrigierte Geschichte der Flutursache

```yaml
id: corrected_flood_cause_story
name: Brandts Eingriff verursachte die Flutgefahr
type: story
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [case_cursed_mill]
presentation:
  style: discovery
  heading: Neue Erkenntnis: Die Flutgefahr entstand am Sägewerk
  body: Brandt ließ den Entlastungskanal absichtlich verschließen. Dadurch konnte das Wasser bei starkem Regen nicht kontrolliert abfließen. Die offizielle Geschichte nennt diesen Eingriff nicht.
```

## C22 – Offene Frage zu Clara im Sägewerk

```yaml
id: question_clara_at_sawmill
name: Offene Frage: Was geschah mit Clara im Sägewerk?
type: story
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [clara_past, confrontation_at_sawmill]
presentation:
  style: contradiction
  heading: Neue offene Frage: Claras Verschwinden
  body: Clara ging kurz vor dem Unwetter zum Sägewerk, um Brandt zur Rede zu stellen. Danach galt sie als vermisst und später als tot.
  openQuestion: Was geschah mit Clara im Sägewerk?
```

Dieses Element wird nach dem Lesen von Claras Geschäftsbuch-Eintrag sichtbar und nach Untersuchung des Lagerraums wieder verborgen.

## C23 – Widerspruch zu Claras Tod

```yaml
id: contradiction_clara_death
name: Widerspruch: Claras Tod
type: story
physical: false
layers: [present, flood_night, clara_return]
locatedIn: null
initialState:
  visible: false
initialPartOf: []
presentation:
  style: contradiction
  heading: Neuer Widerspruch: Claras Tod
  body: Der Gedenkstein nennt Clara als Todesopfer. Auf ihrem Haarband kündigt sie jedoch ausdrücklich eine spätere Rückkehr zur Mühle an.
  openQuestion: Hat Clara die Überschwemmung überlebt?
```

Dieses Element wird durch das Haarband sichtbar und nach dem Lesen von Claras Brief verborgen. Danach ersetzt `clara_survived_story` die bisherige Geschichte.

## C24 – Offene Frage zu Hannes’ Schweigen

```yaml
id: question_hannes_silence
name: Offene Frage: Warum schwieg Hannes?
type: story
physical: false
layers: [flood_night]
locatedIn: null
initialState:
  visible: false
initialPartOf: [hannes_past, official_flood_story]
presentation:
  style: contradiction
  heading: Neuer Widerspruch: Hannes’ Schweigen
  body: Die Stellung des Notwehrs zeigt, dass Hannes das Dorf schützte. Trotzdem nennt ihn die offizielle Geschichte als Verursacher der Flut.
  openQuestion: Warum widersprach Hannes der Anschuldigung nicht?
```

Dieses Element wird sichtbar, sobald Claras Gefangenschaft hinreichend belegt ist. Claras Brief löst es auf und ersetzt es durch `protective_silence`.

---

# Teil D – Freischaltlogik und Dramaturgie

## D01 – Erste Deutung

Durch die Benutzung des Gedenksteins entstehen zunächst diese Zusammenhänge:

```text
Hannes → partOf → Der schuldige Müller
Clara → partOf → Claras Tod in der Mühle
Claras Tod → partOf → Gerücht von der Frau im Regen
```

Erwartete Spielerannahme:

> Hannes verursachte die Flut; Clara starb; ihr Geist erscheint bis heute.

## D02 – Erste Zweifel

Die Notwehrmechanik zeigt, dass die vollständige Öffnung des Wehrs das Dorf schützte und die Mühle opferte. Dadurch wird `contradiction_hannes_guilt` sichtbar und im Gerüchtelog hervorgehoben. Hannes bleibt zunächst noch mit dem Schuldgerücht verbunden, weil die alternative Ursache der Flut noch fehlt.

Die Wartungsnotiz verbindet Brandt mit der absichtlichen Kanalsperre. Damit wird der Widerspruch über die Flutursache aufgelöst: `contradiction_hannes_guilt` wird verborgen, Hannes wird aus `hannes_guilt_rumor` entfernt und `corrected_flood_cause_story` wird sichtbar. Wenn zu diesem Zeitpunkt auch die Stellung des Notwehrs bekannt ist, erscheint die neue Frage nach Hannes’ Schweigen. In der umgekehrten Fundreihenfolge geschieht dies bei der späteren Untersuchung des Notwehrs.

Erwartete neue Annahme:

> Hannes war möglicherweise nicht der Verursacher. Brandts Eingriff erzeugte die Gefahr.

## D03 – Claras Rolle

Die Wartungsnotiz macht Claras Eintrag im Geschäftsbuch zugänglich. Der aktuelle Gegenwartslog-Eintrag der Mühle lautet neutral: „Im Geschäftsbuch auf Hannes’ Schreibtisch befindet sich ein Eintrag des Mädchens von der Mühle. Du kannst die Mühle untersuchen.“

Der Eintrag verbindet Clara mit der Kanalsperre und ihrer Konfrontation mit Brandt. Gleichzeitig wird der alte Lagerraum sichtbar und `question_clara_at_sawmill` erscheint hervorgehoben im Gerüchtelog.

Erwartete neue Annahme:

> Clara kannte die Ursache und ging zum Sägewerk. Ihr Verschwinden hing mit Brandt zusammen.

## D04 – Gefangenschaft und Rückkehr

Türverriegelung einschließlich der Kratzspuren und Haarband verbinden Clara und Brandt mit `clara_imprisonment`. Damit verschwindet `question_clara_at_sawmill`.

Der eindeutige Hinweis auf dem Haarband macht die lose Wandbohle in der Mühle sichtbar. Der Gegenwartslog-Eintrag beschreibt nur den aktuellen Zustand und zeigt:

> Claras Hinweis nennt ein Versteck in der Mühle hinter der dritten Wandbohle neben Hannes’ Schreibtisch. Du kannst die Mühle untersuchen.

Zusätzlich wird `contradiction_clara_death` im Gerüchtelog hervorgehoben.

Claras Brief entfernt Clara aus der Geschichte ihres Todes und verbindet sie mit Überleben, Rettung, schützendem Schweigen und heimlicher Rückkehr. Die Widersprüche zu Claras Tod und Hannes’ Schweigen werden verborgen.

Erwartete endgültige Erkenntnis:

> Brandt verursachte die Flutgefahr und sperrte Clara ein. Hannes rettete Dorf und Tochter. Clara überlebte. Die angebliche Geistererscheinung war ihre spätere Rückkehr.

## D05 – Abschlussbedingung

Die Aufklärung soll nicht davon abhängen, dass jedes optionale Fragment gefunden wurde. Der Fall gilt als verstanden, wenn die folgenden logischen Zustände gleichzeitig bestehen:

```yaml
resolutionConditions:
  - partOfExists: [richard_brandt_past, illegal_channel_closure]
  - partOfExists: [hannes_past, emergency_opening]
  - partOfExists: [clara_past, clara_imprisonment]
  - partOfExists: [clara_past, clara_survived_story]
  - partOfExists: [clara_past, clara_secret_return]
  - partOfMissing: [hannes_past, hannes_guilt_rumor]
  - partOfMissing: [clara_past, clara_death_story]
```

Wenn alle Bedingungen erfüllt sind:

```yaml
effects:
  - setElementState: [case_resolution, visible, true]
  - setElementState: [case_resolution, complete, true]
  - setElementState: [case_cursed_mill, resolved, true]
  - setElementState: [cursed_site_present, curseActive, false]
  - setElementState: [road_out_present, blockedByCurse, false]
  - showTextFrom: case_resolution.presentation.releaseText
```

## D06 – Mögliche Fundreihenfolgen

Die Geschichte unterstützt unterschiedliche Reihenfolgen:

- Der Spieler kann zuerst Mühle oder Sägewerk besuchen.
- Die Wartungsnotiz kann Claras Geschäftsbuch-Eintrag vor dem Brief sichtbar machen.
- Das Haarband kann die Wandbohle und damit Claras Brief vor der vollständigen Klärung der Flutursache sichtbar machen.
- Die Notwehrmechanik kann Hannes früh entlasten oder erst spät die bereits vermutete Wahrheit bestätigen.

Die Makrostruktur bleibt trotzdem erhalten:

1. offizielle Geschichte und Geistergerücht,
2. Zweifel an Hannes' Schuld,
3. Brandts Eingriff und Claras Wissen,
4. Claras Gefangenschaft und Überleben,
5. Auflösung des Geistergerüchts und Freigabe des Ortes.

---

# Teil E – Verbindliche Darstellung der drei Ansichten

## E01 – Aktuelle Welt

Die aktuelle Weltansicht zeigt nur:

- das aktuelle physische Element,
- dessen direkt enthaltene physische Elemente mit `visible: true`,
- ausdrückliche Übergangselemente,
- den automatisch aus `locatedIn` erzeugten Rückweg, sofern kein entsprechendes Übergangselement existiert.

Reine Story-Elemente erscheinen niemals in dieser Ansicht. Alle Beschreibungen stammen aus gespeicherten `presentation`-Feldern. Während des Spiels wird keine KI aufgerufen.

Nur die benutzbaren Elemente der aktuellen Welt werden nummeriert. Die Wissensansichten können zusätzlich über feste Schaltflächen oder nummerierte Menüpunkte geöffnet werden.

## E02 – Gegenwartslog

Das Gegenwartslog enthält ausschließlich Elemente und Informationen der aktuell erkundbaren Gegenwart:

- bekannte gegenwärtige Orte,
- sichtbare oder gefundene physische Gegenstände,
- gegenwärtige Beobachtungen,
- Untersuchungsstatus eines Ortes,
- konkrete Hinweise auf untersuchbare Orte und Ziele.

Vergangene Personen, Ereignisse, Gerüchte und Vermutungen erscheinen hier nicht.

Beim Öffnen werden alle sichtbaren Einträge sofort vollständig in einer scrollbaren Ansicht dargestellt. Es gibt keine Übersicht mit einzeln zu öffnenden Untereinträgen.

Der Untersuchungsstatus wird in dieser Geschichte ausdrücklich durch Trigger gesetzt. Er wird nicht zur Laufzeit semantisch von einer KI erraten. Mögliche Werte:

- `open`: aktuell gibt es noch auffindbare Inhalte,
- `complete`: derzeit vollständig untersucht,
Ein Element kann durch einen Trigger von `complete` zurück auf `open` gesetzt werden. Der angezeigte Text kommentiert diesen Zustandswechsel nicht. Bei `open` muss `currentHint` den Zielort und das konkrete Zielelement eindeutig nennen, sofern der Fund sonst mehrdeutig wäre.

## E03 – Gerüchtelog

Das Gerüchtelog enthält ausschließlich die rekonstruierte Vergangenheit:

- vergangene Personen und Orte,
- vergangene Ereignisse,
- Gerüchte,
- aktuelle Geschichten und Vermutungen,
- Widerspruchsgeschichten und offene Fragen,
- Verbindungen aus dem aktuellen `partOf`-Zustand.

Beim Öffnen werden alle sichtbaren Einträge sofort vollständig angezeigt. Es gibt keine Navigation über einzelne Einträge. Ein Beziehungsnetz kann zusätzlich innerhalb derselben scrollbaren Ansicht erscheinen.

Story-Elemente mit `presentation.style: contradiction` werden deutlich hervorgehoben. Sie sind temporär: Ein Fund macht sie sichtbar; eine spätere Auflösung macht sie wieder unsichtbar und blendet die korrigierte Geschichte ein.

Wichtige sichtbare Umbauten während des Spiels:

```text
Hannes — Der schuldige Müller
```

wird entfernt und ersetzt durch:

```text
Hannes — Öffnung des Notwehrs — Rettung des Dorfes
```

Ebenso wird:

```text
Clara — Tod in der Mühle — Frau im Regen
```

später ersetzt beziehungsweise neu eingeordnet durch:

```text
Clara — Überleben — Heimliche Rückkehr — Frau im Regen
```

---

# Teil F – Statische Texte und Laufzeitverhalten

Für diese Geschichte werden sämtliche Laufzeittexte vorab gespeichert. Dazu gehören:

- erste und wiederholte Raumbeschreibungen,
- Texte beim ersten und wiederholten Benutzen,
- Widerspruchshinweise,
- offene Fragen,
- neutrale Hinweise auf untersuchbare Orte,
- Meldungen über neue Geschichten,
- Abschluss- und Ausgangstext.

Eine KI darf diese Inhalte beim Erstellen oder Überarbeiten der Geschichte erzeugen. Die geprüften Ergebnisse werden anschließend als feste Daten gespeichert. Im laufenden Spiel werden keine Texte dynamisch von einer KI erzeugt.

Noch technisch zu klären bleiben nur allgemeine Engine-Fragen:

1. Konfliktregel, wenn mehrere gleichzeitig ausgeführte Trigger dasselbe Feld ändern.
2. Zeitpunkt, zu dem während einer Benutzung neu aktivierte Trigger geprüft werden.
3. endgültige Trennung von unveränderlicher Geschichtsdefinition und gespeichertem Laufzeitzustand.
4. formales JSON-Schema und automatischer Erreichbarkeitstest.

Die Auflösung verwendet bewusst zentrale Zusammenhänge statt einer Pflichtquote aller Fragmente.

## Ergebnis

Der Fall ist klein genug für einen ersten Textprototyp, enthält aber alle Kernideen des Systems:

- physische und reine Story-Elemente,
- mehrere Ebenen,
- verschachtelte räumliche Elemente,
- genau ein `locatedIn` pro Element,
- dynamisches `partOf`-Netz,
- Fakten und veränderliche Vermutungen,
- versteckte Elemente, die durch Wissen sichtbar werden,
- freie Fundreihenfolge innerhalb einer verdeckten Dramaturgie,
- mehrere Twists,
- temporär sichtbare und hervorgehobene Widerspruchsgeschichten,
- vollständige, nicht verschachtelte Gegenwarts- und Gerüchtelogs,
- ausschließlich vorab gespeicherte Texte,
- eine wissensbasierte Abschlussbedingung,
- Ableitung von Weltansicht, Logbuch und Gerüchtekarte aus denselben Elementdaten.
