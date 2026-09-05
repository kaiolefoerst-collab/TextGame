# Autorenregeln für elementbasierte Erzählspiele

## 1. Zweck des Dokuments

Dieses Dokument richtet sich an Menschen oder KIs, die eine Geschichte für das elementbasierte Erzähl- und Erkundungsspiel schreiben. Es beschreibt die erzählerischen Regeln, Qualitätsmaßstäbe und Prüfungen, die beim Aufbau einer Geschichte zu beachten sind.

Der vollständige technische Aufbau der Elemente wird in diesem Dokument nicht wiederholt. Dafür gelten das technische Spielkonzept und eine von der Game-Engine lesbare YAML-Beispielgeschichte. Die Datei `cursed_mill.yaml` ist die verbindliche technische Referenz für Aufbau, Feldnamen, Bedingungen und Effekte zukünftiger Geschichten.

Eine Geschichte soll zunächst als Textadventure vollständig funktionieren. Die spätere grafische Umsetzung darf die Präsentation erweitern, aber keine erzählerischen Lücken verdecken.

## 2. Grundhaltung beim Schreiben

Die Geschichte ist kein Vorwand für eine Folge von Suchaufgaben. Das Erkunden, Finden und Verknüpfen der Elemente ist selbst die Erzählform.

Der Spieler soll erleben, wie aus einzelnen Beobachtungen ein zunächst unvollständiges Bild entsteht. Neue Erkenntnisse dürfen dieses Bild bestätigen, erweitern oder überraschend verändern.

Eine gute Geschichte für dieses System ist:

- erzählerisch dicht,
- atmosphärisch,
- klar verständlich,
- in kleinen Einheiten erfassbar,
- spannend, ohne schwere Rätsel zu verlangen,
- in ihrem Ablauf kontrolliert, obwohl Funde teilweise in freier Reihenfolge möglich sind,
- fair: Ein Twist muss rückblickend durch bereits vorhandene Fakten getragen werden.

## 3. Die vollständige Wahrheit zuerst schreiben

Bevor einzelne Fundstellen oder Texte entstehen, muss die tatsächliche Geschichte vollständig feststehen.

Der Autor muss mindestens wissen:

- Was geschah tatsächlich?
- In welcher chronologischen Reihenfolge geschah es?
- Wer handelte und mit welchem Motiv?
- Welche Folgen hatten die Handlungen?
- Welche Version der Geschichte ist zu Beginn bekannt?
- Welche Teile dieser Version sind falsch oder unvollständig?
- Welche Wahrheit soll der Spieler am Ende verstanden haben?

Die kanonische Wahrheit darf während der Ausarbeitung nicht nachträglich beliebig verändert werden, nur um einen überraschenden Twist zu erzeugen. Ein Twist verändert die Deutung bekannter Fakten; er ersetzt nicht willkürlich die zugrunde liegende Wirklichkeit.

## 4. Drei Reihenfolgen unterscheiden

Der Autor muss drei verschiedene Ordnungen getrennt planen:

1. **Chronologie:** So geschah die Vergangenheit tatsächlich.
2. **Fundreihenfolge:** In dieser Reihenfolge findet ein konkreter Spieler die Informationen.
3. **Enthüllungsstruktur:** In dieser Reihenfolge sollen die größeren Zusammenhänge verständlich werden.

Die Enthüllungsstruktur muss nicht chronologisch sein. Sie kann thematisch nach Personen, Orten, Gerüchten, Konflikten oder Geheimnissen aufgebaut werden.

Innerhalb eines Abschnitts dürfen Funde in unterschiedlicher Reihenfolge möglich sein. Die übergeordnete Dramaturgie darf durch Bedingungen und Freischaltungen gelenkt werden, ohne wie eine sichtbare lineare Aufgabenliste zu wirken.

## 5. Erzählerische Dichte

Jedes wichtige Element muss mindestens eine der folgenden Funktionen erfüllen:

- Atmosphäre aufbauen,
- eine Person charakterisieren,
- einen Fakt vermitteln,
- eine Vermutung erzeugen,
- eine bestehende Vermutung verändern,
- einen Widerspruch auslösen,
- eine Beziehung sichtbar machen,
- eine neue Untersuchungsmöglichkeit eröffnen,
- einen späteren Twist vorbereiten.

Elemente ohne erkennbare Funktion sollen entfernt oder mit einem funktionalen Element verbunden werden. Die Welt darf dekorative Details besitzen, aber der Spieler soll nicht mit einer großen Zahl bedeutungsloser benutzbarer Elemente belastet werden.

Ein kleiner, dichter Schauplatz ist für dieses Spielprinzip meist stärker als eine große, leere Welt.

## 6. Atmosphäre aufbauen

Raum- und Objekttexte sollen nicht nur Inventarlisten sein. Sie sollen eine Stimmung erzeugen und gleichzeitig klar bleiben.

Atmosphäre entsteht unter anderem durch:

- präzise ausgewählte Sinneseindrücke,
- Spuren vergangener Nutzung,
- sichtbare Folgen eines Ereignisses,
- Kontraste zwischen früherer Bedeutung und heutigem Zustand,
- wiederkehrende Motive,
- zurückhaltende, konkrete Details.

Beispiel einer nüchternen Beschreibung:

> Im Raum stehen ein Schreibtisch und ein Schrank.

Atmosphärisch dichter:

> Unter dem eingestürzten Dach steht ein aufgequollener Schreibtisch. Aus einer halb geöffneten Schublade ragen feuchte, zusammengeklebte Papiere.

Die Beschreibung darf keine Gegenstände hervorheben, die wie benutzbare Elemente wirken, wenn sie im Spiel nicht benutzt werden können. Dekoration muss sprachlich eindeutig Hintergrund bleiben oder als benutzbares Element angelegt werden.

## 7. Alle angezeigten Texte vollständig schreiben

Während des Spiels wird keine KI zur Textgenerierung eingesetzt. Eine KI kann beim Erstellen der Geschichte helfen, aber alle Ergebnisse werden vor Veröffentlichung geprüft und gespeichert.

Der Autor muss jeden Text vollständig ausformulieren, der dem Spieler angezeigt werden kann:

- erste Raumbeschreibung,
- spätere gültige Raumbeschreibungen,
- Texte beim Benutzen eines Elements,
- Wiederholungstexte,
- Fakten,
- Vermutungen,
- Widersprüche,
- offene Fragen,
- Zielhinweise,
- Übergänge,
- Inschriften,
- Briefe und Notizen,
- Dialoge,
- Meldungen zu Erkenntnissen,
- Abschluss- und Ausgangstexte.

Es reicht nicht, nur die zugrunde liegenden Fakten zu speichern und zu erwarten, dass die Engine daraus einen passenden Erzähltext erfindet.

## 8. Länge der Texte

Texte sollen auf Mobilgeräten angenehm lesbar bleiben. Jeder Text muss so lang wie nötig und so kurz wie möglich sein.

Richtwerte:

- Raumbeschreibung: meist zwei bis fünf kurze Sätze,
- Beschreibung eines einfachen Gegenstands: meist ein bis drei Sätze,
- Ergebnis einer Benutzung: meist ein kurzer Absatz,
- Vermutung: ein oder zwei Sätze,
- Widerspruch: zwei kurze Aussagen und eine klare offene Frage,
- normale Notiz oder Inschrift: möglichst ein bis drei kurze Zeilen,
- gewöhnlicher Brief: wenige kurze Absätze,
- zentrales Dokument: darf länger sein, wenn sein vollständiger Wortlaut für Wirkung oder Verständnis wesentlich ist.

Lange Texte sollen nur verwendet werden, wenn ihre Länge erzählerisch gerechtfertigt ist. Mehrere kurze Funde sind häufig wirkungsvoller als ein langer Erklärungstext.

## 9. Inschriften, Briefe und Dokumente

Inschriften und kurze Notizen sollen knapp formuliert sein. Menschen verfassen auf Steinen, Türen oder Gegenständen normalerweise keine langen Erklärungen.

Eine längere Inschrift ist nur sinnvoll, wenn sie für die Geschichte zentral ist und ihre Ausführlichkeit innerhalb der Welt glaubwürdig erklärt werden kann.

Briefe und andere zentrale Dokumente müssen vollständig ausformuliert werden. Neben dem wörtlichen Dokumenttext dürfen getrennt gespeichert werden:

- daraus gewonnene Fakten,
- die aktuelle Vermutung der Spielfigur,
- ausgelöste Widersprüche,
- neue Untersuchungsziele.

Der wörtliche Inhalt und seine spielmechanische Auswertung sind nicht dasselbe.

Ein Dokument darf dem Spieler nicht Informationen zuschreiben, die in seinem tatsächlichen Wortlaut nicht enthalten oder vernünftig daraus ableitbar sind.

## 10. Fakten und Vermutungen sauber trennen

Ein Fakt beschreibt, was gefunden, gelesen oder unmittelbar beobachtet wurde. Er bleibt bestehen.

Eine Vermutung ist die vom Spiel vorgegebene gegenwärtige Interpretation. Sie darf sich ändern.

Beispiel:

**Fakt:**

> Das Wehr stand vollständig geöffnet.

**Vermutung:**

> Der Müller könnte die Zerstörung seiner Mühle bewusst in Kauf genommen haben, um das Dorf zu schützen.

Der Autor darf eine Vermutung nicht als Fakt formulieren. Wörter wie „offenbar“, „möglicherweise“, „könnte“ oder „wahrscheinlich“ sind sinnvoll, wenn die Schlussfolgerung noch nicht gesichert ist.

Spätere Erkenntnisse können Vermutungen ersetzen, dürfen aber gefundene Fakten nicht ohne glaubwürdigen Grund ungeschehen machen.

## 11. Widersprüche als Motor der Geschichte

Ein Widerspruch ist eine vorübergehend sichtbare Geschichte. Er entsteht, wenn zwei bekannte Informationen nicht sinnvoll in die aktuelle Deutung passen.

Widersprüche gehören ausschließlich in das Gerüchtelog und werden dort deutlich hervorgehoben.

Ein guter Widerspruch besteht aus:

1. der bisherigen Annahme,
2. dem widersprechenden neuen Fakt,
3. einer klaren offenen Frage.

Beispiel:

> **Widerspruch: Claras Tod**  
> Der Gedenkstein nennt Clara als Todesopfer. Auf ihrem Haarband kündigt sie jedoch eine spätere Rückkehr zur Mühle an.  
> **Hat Clara die Überschwemmung überlebt?**

Widersprüche müssen vorab geschrieben und als Geschichten angelegt werden. Die Engine leitet sie nicht semantisch aus beliebigen Fakten ab.

## 12. Lebenszyklus eines Widerspruchs

Jeder Widerspruch braucht einen vollständigen Lebenszyklus:

1. Welche Funde machen ihn sichtbar?
2. Welche aktuelle Geschichte stellt er infrage?
3. Welche offene Frage erzeugt er?
4. Welche Funde lösen ihn auf?
5. Welche neue Geschichte ersetzt ihn?
6. Welche alten Beziehungen oder Geschichten werden dabei entfernt?

Ein gelöster Widerspruch wird im Gerüchtelog nicht dauerhaft weitergeführt. Er wird unsichtbar und durch die neue gültige Geschichte ersetzt.

Der Spieler soll dadurch immer das aktuelle Modell der Vergangenheit sehen und kein unübersichtliches Archiv sämtlicher Zwischenstände.

## 13. Offene Fragen

Offene Fragen können wie Widersprüche als vorübergehende Geschichten behandelt und hervorgehoben werden.

Sie sollen:

- aus bereits bekannten Fakten entstehen,
- eine klare Richtung für die weitere Erkundung geben,
- keine Lösung vorwegnehmen,
- nach ihrer Beantwortung verschwinden oder durch eine Erkenntnis ersetzt werden.

Offene Fragen dürfen nicht beliebig von der Engine oder einer KI ergänzt werden. Sie sind Teil der geplanten Dramaturgie.

## 14. Twists fair vorbereiten

Ein Twist soll überraschen, aber rückblickend logisch wirken.

Vor dem Twist müssen ausreichende Spuren vorhanden sein. Diese dürfen zunächst anders gedeutet werden, dürfen der späteren Wahrheit aber nicht widersprechen.

Ein guter Twist:

- verändert die Bedeutung bekannter Fakten,
- verändert Beziehungen zwischen Geschichten,
- löst mindestens einen Widerspruch,
- erzeugt möglicherweise eine neue offene Frage,
- vertieft Figuren oder Motive,
- ist nicht nur eine willkürliche zusätzliche Information.

Die stärkste Wirkung entsteht oft in mehreren Stufen:

1. scheinbar plausible erste Geschichte,
2. scheinbare Bestätigung,
3. störender Fakt,
4. sichtbarer Widerspruch,
5. neue Deutung,
6. spätere Vertiefung oder zweite Wendung.

## 15. Freie Fundreihenfolge berücksichtigen

Jeder Text muss für jede erlaubte Fundreihenfolge geprüft werden.

Insbesondere darf der Text nicht ohne gesicherte Grundlage behaupten, dass der Spieler:

- einen Ort schon besucht hat,
- einen Gegenstand bereits gesehen hat,
- etwas vorher übersehen hat,
- irgendwohin zurückkehrt,
- eine Information gerade zum ersten Mal hört,
- eine bestimmte andere Spur bereits kennt.

Wörter und Wendungen wie diese sind nur zulässig, wenn die entsprechende Bedingung technisch garantiert ist:

- jetzt,
- nun,
- erneut,
- wieder,
- inzwischen,
- vorher,
- bisher,
- beim letzten Besuch,
- dir fällt plötzlich auf,
- du erinnerst dich.

Im Zweifel wird ausschließlich der aktuelle Zustand beschrieben.

## 16. Aktuellen Zustand statt Zustandswechsel formulieren

Logtexte werden so behandelt, als wären sie der aktuelle Starteintrag. Sie beschreiben nicht, wie der Zustand entstanden ist.

Falsch:

> Du kannst die Mühle jetzt erneut untersuchen.

Ebenfalls ungünstig:

> In der Mühle kann jetzt die dritte Bohle untersucht werden.

Richtig:

> Claras Hinweis nennt ein Versteck in der Mühle hinter der dritten Wandbohle neben Hannes’ Schreibtisch.

Und als neutraler Untersuchungsstatus:

> Du kannst die Mühle untersuchen.

Allgemeine Regel:

> Jeder angezeigte Text beschreibt ausschließlich den aktuellen Zustand der Welt oder des Wissens. Er trifft keine Annahme darüber, auf welchem Weg der Spieler diesen Zustand erreicht hat.

## 17. Untersuchungsziele eindeutig benennen

Das Spiel soll keine schweren Rätsel enthalten. Wenn Wissen ein verborgenes Element zugänglich macht, muss klar sein, wo gesucht werden soll.

Ein Zielhinweis soll nach Möglichkeit nennen:

- den Ort,
- das relevante Element,
- gegebenenfalls die genaue Position innerhalb des Elements.

Zu ungenau:

> Hinter der dritten Bohle.

Besser:

> In der Mühle befindet sich hinter der dritten Wandbohle neben Hannes’ Schreibtisch ein Versteck.

Der Spieler soll die Geschichte rekonstruieren und nicht an einer mehrdeutigen Ortsangabe scheitern.

## 18. Gegenwartslog schreiben

Das Gegenwartslog enthält ausschließlich die aktuell erkundbare Welt:

- bekannte Orte,
- gegenwärtige Räume,
- physische Gegenstände,
- aktuelle Beobachtungen,
- Untersuchungsstatus,
- konkrete Untersuchungsansätze.

Es enthält keine vergangenen Personen, historischen Ereignisse oder Vermutungen über die vergangene Geschichte.

Alle sichtbaren Einträge werden beim Öffnen sofort vollständig angezeigt. Die Inhalte müssen kurz genug bleiben, um in einer scrollbaren Ansicht erfassbar zu sein.

Mögliche neutrale Statusformulierungen:

- „Du kannst die Mühle untersuchen.“
- „In der Mühle gibt es derzeit nichts weiter zu untersuchen.“
- „Das Geschäftsbuch kann untersucht werden.“

Ein Status darf nur „vollständig“ oder „nichts weiter“ behaupten, wenn der Autor sichergestellt hat, dass im aktuellen Zustand kein relevanter erreichbarer Fund mehr offen ist.

## 19. Gerüchtelog schreiben

Das Gerüchtelog enthält ausschließlich die rekonstruierte Vergangenheit:

- vergangene Personen und Orte,
- Ereignisse,
- Gerüchte,
- Fakten,
- aktuelle Vermutungen,
- Geschichten,
- Widersprüche,
- offene Fragen,
- bekannte Beziehungen.

Alle sichtbaren Einträge werden beim Öffnen sofort vollständig angezeigt. Es gibt keine Folge von Untermenüs für einzelne Einträge.

Das Gerüchtelog zeigt grundsätzlich das aktuelle Verständnis des Spielers. Widerlegte Geschichten und gelöste Widersprüche werden entfernt oder ausdrücklich durch eine neue Geschichte ersetzt.

Widersprüche und offene Fragen werden visuell hervorgehoben, weil sie die Geschichte vorantreiben.

## 20. Hinweise und Benachrichtigungen

Benachrichtigungen sollen sparsam eingesetzt werden. Sie dürfen den Spieler informieren, dass sich sein Wissen oder eine Untersuchungsmöglichkeit verändert hat. Der eigentliche Inhalt steht jedoch in den aktualisierten Logs.

Eine Benachrichtigung soll keine falsche Besuchshistorie voraussetzen.

Neutral:

> Das Gegenwartslog wurde aktualisiert.

Problematisch:

> Kehre zur Mühle zurück; dort hast du etwas übersehen.

Wenn eine konkretere Nachricht nötig ist, beschreibt sie den aktuellen Zusammenhang:

> Claras Hinweis betrifft ein Versteck in der Mühle.

## 21. Wiederholungstexte

Jedes mehrfach benutzbare Element benötigt einen passenden Wiederholungstext oder eine eindeutig definierte Standardreaktion.

Ein Wiederholungstext soll:

- die wichtigste bekannte Information knapp wiederholen,
- deutlich machen, ob noch etwas gefunden werden kann,
- keine neuen Fakten erfinden,
- nicht jedes Mal einen bereits verbrauchten Fund auslösen.

Beispiel:

> Die Verriegelung kann nur von außen bedient werden. Weitere Informationen sind hier nicht zu finden.

## 22. Räumliche Klarheit

Orte, Behältnisse und Übergänge müssen für den Spieler verständlich beschrieben sein.

Der Autor muss prüfen:

- Wo befindet sich jedes physische Element?
- Von welchem Element aus ist es erreichbar?
- Ist der Rückweg klar?
- Ist erkennbar, ob etwas ein Raum, ein Behältnis oder ein Übergang ist?
- Verweist ein Hinweis eindeutig auf den richtigen Ort?

Mehrere Orte dürfen ähnlich aussehen, aber spielrelevante Hinweise dürfen dadurch nicht unbeabsichtigt mehrdeutig werden.

## 23. Einfache Interaktion respektieren

Der Spieler kann nur ein Element benutzen. Der Autor darf keine Aufgaben schreiben, die eine nicht vorhandene komplizierte Bedienung voraussetzen.

Das Benutzen eines Elements kann abhängig vom Zustand bedeuten:

- betreten,
- öffnen,
- schließen,
- lesen,
- untersuchen,
- aufnehmen,
- sprechen,
- einen passenden Gegenstand automatisch verwenden,
- einen Ebenenwechsel auslösen.

Der Text muss deutlich machen, was durch die Benutzung geschieht. Die Geschichte soll nicht verlangen, dass der Spieler Verben errät oder Gegenstände durch Ausprobieren miteinander kombiniert.

## 24. Führung ohne schwere Rätsel

Der Spieler darf nachdenken, soll aber nicht wegen fehlender Bedienhinweise oder unklarer Ortsangaben stecken bleiben.

Die Herausforderung liegt im Verstehen der Geschichte, nicht in:

- Pixeljagd,
- willkürlichen Zahlencodes,
- langen Inventarkombinationen,
- mehrdeutigen Richtungsangaben,
- wiederholtem Absuchen bereits erledigter Orte,
- dem Erraten einer vom Autor gedachten Formulierung.

Ein Widerspruch kann die nächste Richtung andeuten. Das Gegenwartslog muss anschließend ausreichend klar zeigen, welcher Ort untersucht werden kann.

## 25. Redundanz gezielt einsetzen

Zentrale Wahrheiten sollten nicht ausschließlich an einem unscheinbaren optionalen Fund hängen. Wichtige Informationen dürfen durch mehrere Elemente gestützt werden.

Redundanz ist sinnvoll, wenn unterschiedliche Funde verschiedene Funktionen erfüllen:

- ein Dokument nennt einen Fakt,
- ein physischer Gegenstand bestätigt ihn,
- ein Ort zeigt seine Folgen,
- eine Person erklärt das Motiv.

Wörtliche Wiederholungen ohne neue Bedeutung sollen vermieden werden.

## 26. Tempo und Spannungsbogen

Die Geschichte braucht erkennbare Etappen. Nach einigen Funden sollte sich das Verständnis spürbar verändern.

Ein möglicher Rhythmus:

1. Ausgangslage und erstes Gerücht,
2. einige stützende Fakten,
3. erster Widerspruch,
4. neue Geschichte,
5. persönlicher oder moralischer Konflikt,
6. zweiter Widerspruch oder Twist,
7. abschließende Erklärung,
8. Konsequenz in der Gegenwart.

Zu viele Funde ohne Veränderung des Verständnisses wirken wie Sammelarbeit. Zu viele Wendungen in kurzer Folge wirken beliebig.

## 27. Personen und Motive

Personen sollen nicht nur Funktionen im Rätsel erfüllen. Wichtige Figuren benötigen nachvollziehbare Motive, Grenzen und Konsequenzen ihres Handelns.

Der Autor sollte für jede zentrale Person beantworten:

- Was will sie?
- Was befürchtet sie?
- Was weiß sie zu welchem Zeitpunkt?
- Was verschweigt oder missversteht sie?
- Welche Entscheidung trifft sie?
- Welche Spuren hinterlässt diese Entscheidung?
- Wie verändert sich das Bild dieser Person im Verlauf der Geschichte?

Eine gute Wendung macht eine Figur häufig nicht einfach „gut“ oder „böse“, sondern verständlicher und komplexer.

## 28. Abschluss einer Geschichte

Das Ende darf nicht allein durch das Finden einer festgelegten Anzahl von Fragmenten ausgelöst werden. Entscheidend sind die zentralen verstandenen Zusammenhänge.

Der Abschluss muss beantworten:

- Welche Wahrheit wurde erkannt?
- Welche aktiven Widersprüche wurden gelöst?
- Welche falschen Geschichten wurden entfernt?
- Welche endgültige Geschichte bleibt sichtbar?
- Welche Folge hat das Wissen in der aktuellen Welt?

Der Abschluss- und Ausgangstext muss vollständig ausformuliert sein. Ein technischer Effekt wie `finishGame` ersetzt keinen erzählerischen Schluss.

## 29. Prüfung unterschiedlicher Fundreihenfolgen

Vor Freigabe der Geschichte müssen alle wesentlichen zulässigen Wege getestet werden.

Mindestens zu prüfen sind:

- zuerst Ort A, dann Ort B,
- zuerst Ort B, dann Ort A,
- frühes Öffnen beider Logs,
- wiederholtes Benutzen jedes Elements,
- Besuch eines Ortes vor und nach einer Freischaltung,
- Auflösung eines Zusammenhangs, bevor ein vorgesehener Widerspruch entdeckt wurde,
- Rückkehr zu einem bereits vollständig untersuchten Ort,
- Versuch, das Spiel frühzeitig zu verlassen,
- Erreichen des Endes ohne optionale Fragmente.

Ein Widerspruch darf nicht nach seiner Auflösung durch eine andere Fundreihenfolge wieder erscheinen. Ein erledigter Zielhinweis muss verschwinden. Eine widerlegte Geschichte darf nicht unverändert im Gerüchtelog bleiben.

## 30. Prüfung aller Texte auf Reihenfolgeabhängigkeit

Jeder angezeigte Text wird vor Freigabe mit diesen Fragen geprüft:

- Behauptet der Text einen früheren Besuch?
- Behauptet er, der Spieler habe etwas übersehen?
- Verwendet er „jetzt“, obwohl derselbe Zustand auch beim ersten Besuch gelten kann?
- Verwendet er „zurück“, obwohl der Spieler noch nie dort war?
- Erwähnt er Wissen, das auf diesem Spielweg noch unbekannt sein könnte?
- Nennt er ein Element, das noch nicht sichtbar ist?
- Beschreibt er Dekoration so, als könnte sie benutzt werden?
- Fasst er Fakten zusammen, ohne dass dieser Zusammenfassungstext gespeichert ist?

Wenn eine dieser Fragen mit Ja beantwortet wird, benötigt der Text entweder eine technische Bedingung oder eine neutrale Neuformulierung.

## 31. Abschlussprüfung für Autoren

Vor Übergabe einer Geschichte an die Programmierung muss der Autor bestätigen:

- Die kanonische Wahrheit ist vollständig und widerspruchsfrei.
- Chronologie und Enthüllungsstruktur sind getrennt dokumentiert.
- Jeder zentrale Twist ist vorher fair vorbereitet.
- Alle Widersprüche besitzen Auslöser, offene Frage, Auflösung und Ersatzgeschichte.
- Alle offenen Fragen werden beantwortet oder bewusst offen gelassen.
- Gegenwartslog und Gerüchtelog enthalten keine vermischten Zeitebenen.
- Jeder tatsächlich sichtbare Text ist vollständig ausformuliert.
- Inschriften und beiläufige Dokumente sind knapp gehalten.
- Zentrale Briefe und Dokumente besitzen einen vollständigen Wortlaut.
- Zielhinweise nennen Ort und relevantes Element eindeutig.
- Texte beschreiben Zustände und keine ungesicherte Spielhistorie.
- Wiederholungstexte sind vorhanden.
- Erledigte Zielhinweise verschwinden.
- Widerlegte Geschichten und gelöste Widersprüche verschwinden oder werden ersetzt.
- Alternative Fundreihenfolgen wurden getestet.
- Der Spieler kann nicht dauerhaft feststecken.
- Der Abschluss ist erzählerisch ausformuliert.
- Alle Texte sind auf einem Mobilgerät gut lesbar.
- Die vollständige Geschichte liegt in einer YAML-Datei vor, die dem Aufbau der technischen Referenzgeschichte entspricht.
- Es werden keine Felder, Bedingungen oder Effekte vorausgesetzt, welche die Game-Engine nicht unterstützt.

## 32. Arbeitsweise für neue Geschichten

Empfohlene Reihenfolge:

1. vollständige wahre Vergangenheit schreiben,
2. anfänglich geglaubte Geschichte festlegen,
3. zentrale Personen, Orte, Ereignisse und Gerüchte bestimmen,
4. Enthüllungsstufen und Twists planen,
5. Widersprüche und offene Fragen formulieren,
6. Fundstellen der Gegenwart festlegen,
7. Auswirkungen zwischen Geschichten und Gegenwart planen,
8. alle angezeigten Texte vollständig schreiben,
9. Gegenwartslog und Gerüchtelog für jede Enthüllungsstufe prüfen,
10. unterschiedliche Fundreihenfolgen durchspielen,
11. erst danach die Geschichte vollständig in das verbindliche YAML-Format übertragen.

## 33. Verbindliches Übergabeformat für Geschichten

Zukünftige Geschichten werden als vollständige YAML-Dateien erstellt. Die Game-Engine liest diese Dateien unmittelbar ein. Das YAML-Format ist deshalb kein erläuternder Anhang, sondern die ausführbare Beschreibung der konkreten Geschichte.

Für die Arbeit gelten drei voneinander getrennte Grundlagen:

1. Das Spielkonzept beschreibt die allgemeinen Regeln und die Funktionsweise des Spiels.
2. Die Autorenregeln beschreiben Dramaturgie, Atmosphäre, Verständlichkeit und Textqualität.
3. Die YAML-Geschichte enthält alle konkreten Inhalte, Zustände, Verbindungen, Bedingungen, Effekte und Laufzeittexte, welche die Game-Engine ausführt oder anzeigt.

Die Datei `cursed_mill.yaml` dient als technische Vorlage. Neue Geschichten müssen ihrer Grundstruktur und den von der Engine unterstützten Feldkonventionen entsprechen. Dazu gehören insbesondere:

- `header` für Metadaten, Kapitelzugehörigkeit und Startelement,
- `layers` für sämtliche Zeit- und Geschichtebenen,
- `resolution` für die globalen Abschlussbedingungen und Abschlusseffekte,
- `elements` für alle physischen und reinen Story-Elemente,
- `locatedIn` für die eindeutige räumliche Position eines physischen Elements,
- `initialState` für den vollständigen Startzustand,
- `initialPartOf` für die anfänglichen logischen Beziehungen,
- `presentation` für sämtliche vorformulierten Laufzeittexte,
- `fragments` für Fakten und Vermutungen,
- `onUse` für Trigger, Bedingungen und Effekte,
- optionale, von der Engine unterstützte Felder wie `image` und `voice`.

Eine neue Geschichte darf keine unbekannten Felder, Konditionstypen oder Effekttypen erfinden und nicht voraussetzen, dass die Engine fehlende Zusammenhänge oder Texte selbst ergänzt. Benötigt eine Geschichte eine neue technische Funktion, muss diese zunächst ausdrücklich als Erweiterung der Engine und des YAML-Formats festgelegt werden.

Alle spielbaren Inhalte müssen in der YAML-Datei enthalten sein. Dazu gehören auch erste und wiederholte Beschreibungen, vollständige Dokumenttexte, Zielhinweise, Widersprüche, offene Fragen, Zustandsänderungen, Freischaltungen sowie Abschluss- und Ausgangstexte.

Die Markdown-Dokumente dienen als konzeptionelle und erzählerische Vorgaben. Sie ersetzen die ausführbare YAML-Geschichte nicht. Umgekehrt muss die YAML-Datei die Regeln des Spielkonzepts und dieses Autorendokuments einhalten.

Dieses Dokument ist eine erste Fassung. Es soll nach weiteren Testgeschichten und Spieldurchläufen fortlaufend ergänzt und präzisiert werden.
