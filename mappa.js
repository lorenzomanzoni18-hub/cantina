/* ===== Mappa dei vini: Mondo › Paese › Regione › Denominazione =====
   Cartina disegnata in SVG (niente tessere da internet): i confini sono in geo/*.json,
   caricati solo quando si apre la Mappa e poi tenuti in cache dal service worker. */

// Zone del vino. p = paese, g = regione (Italia: regione amministrativa; Francia: regione vinicola),
// la/lo = coordinate indicative, k = parole che riconoscono la zona nel campo «Zona» della bottiglia.
// Una voce con n === p è il paese generico, con n === g è la regione generica.
const Z = (p, g, n, la, lo, k, i) => ({ p, g, n, la, lo, k, i: i || '' });
const REGIONS = [
  // ---------- ITALIA ----------
  Z('Italia', '', 'Italia', 42.8, 12.5, ['italia', 'vino d italia', 'vino rosso d italia'], 'Più di 500 denominazioni tra DOCG, DOC e IGT, dalle Alpi alla Sicilia.'),
  Z('Italia', 'Piemonte', 'Piemonte', 44.9, 7.9, ['piemonte'], 'La regione del Nebbiolo, della Barbera e del Moscato.'),
  Z('Italia', 'Piemonte', 'Barolo', 44.61, 7.94, ['barolo'], 'DOCG. Nebbiolo in purezza dalle Langhe: rossi strutturati e tannici, profumi di rosa, catrame e spezie. Minimo 38 mesi di affinamento.'),
  Z('Italia', 'Piemonte', 'Barbaresco', 44.73, 8.08, ['barbaresco'], 'DOCG. Nebbiolo in purezza, di solito più elegante e pronto del Barolo.'),
  Z('Italia', 'Piemonte', 'Langhe e Roero', 44.68, 8.02, ['langhe', 'roero', 'dolcetto d alba', 'barbera d alba', 'nebbiolo d alba', 'arneis', 'diano d alba', 'alba'], 'Colline di Alba: Nebbiolo, Barbera, Dolcetto e l’Arneis per i bianchi.'),
  Z('Italia', 'Piemonte', 'Dogliani', 44.53, 7.94, ['dogliani'], 'DOCG. Dolcetto nella sua versione più seria.'),
  Z('Italia', 'Piemonte', 'Asti e Monferrato', 44.9, 8.2, ['asti', 'monferrato', 'barbera d asti', 'moscato d asti', 'grignolino', 'nizza', 'ruche', 'freisa', 'brachetto'], 'Barbera d’Asti e Nizza, Grignolino, Ruchè, Moscato d’Asti e Asti spumante.'),
  Z('Italia', 'Piemonte', 'Gavi', 44.69, 8.8, ['gavi', 'cortese di gavi'], 'DOCG. Cortese: bianco fresco e sapido.'),
  Z('Italia', 'Piemonte', 'Alto Piemonte', 45.62, 8.37, ['gattinara', 'ghemme', 'boca', 'bramaterra', 'lessona', 'sizzano', 'fara', 'alto piemonte', 'coste della sesia', 'colline novaresi'], 'Nebbiolo (Spanna) del nord: Gattinara e Ghemme DOCG, Lessona, Boca, Bramaterra.'),
  Z('Italia', 'Piemonte', 'Carema', 45.58, 7.81, ['carema'], 'Nebbiolo di montagna su pergole di pietra.'),
  Z('Italia', 'Valle d\'Aosta', 'Valle d\'Aosta', 45.74, 7.32, ['valle d aosta', 'vallee d aoste', 'aosta', 'petite arvine', 'fumin', 'prie blanc', 'morgex', 'torrette', 'donnas', 'enfer d arvier'], 'Vigneti alpini fino a 1200 m: Petite Arvine, Fumin, Prié Blanc, Nebbiolo di Donnas.'),
  Z('Italia', 'Lombardia', 'Lombardia', 45.6, 9.6, ['lombardia', 'terre lariane', 'provincia di pavia'], 'Metodo classico in Franciacorta e Oltrepò, Nebbiolo in Valtellina.'),
  Z('Italia', 'Lombardia', 'Franciacorta', 45.62, 10.0, ['franciacorta', 'satèn', 'saten'], 'DOCG. Metodo classico da Chardonnay, Pinot Nero e Pinot Bianco, sulle colline del lago d’Iseo.'),
  Z('Italia', 'Lombardia', 'Valtellina', 46.17, 9.87, ['valtellina', 'sforzato', 'sfursat', 'sassella', 'inferno', 'grumello', 'valgella', 'maroggia'], 'Nebbiolo (Chiavennasca) su terrazzamenti alpini; lo Sforzato da uve appassite.'),
  Z('Italia', 'Lombardia', 'Oltrepò Pavese', 44.96, 9.18, ['oltrepo', 'buttafuoco', 'sangue di giuda', 'bonarda'], 'Pinot Nero anche metodo classico, Bonarda, Buttafuoco.'),
  Z('Italia', 'Lombardia', 'Lugana', 45.46, 10.62, ['lugana', 'turbiana'], 'Turbiana (Trebbiano di Lugana) sul lago di Garda.'),
  Z('Italia', 'Lombardia', 'Valtènesi', 45.6, 10.52, ['valtenesi', 'chiaretto', 'riviera del garda', 'groppello'], 'Riviera bresciana del Garda: Groppello e il rosato Chiaretto.'),
  Z('Italia', 'Trentino-Alto Adige', 'Trentino-Alto Adige', 46.4, 11.2, ['trentino alto adige', 'vigneti delle dolomiti', 'dolomiti'], 'Vini di montagna tra Trento e Bolzano.'),
  Z('Italia', 'Trentino-Alto Adige', 'Trentino', 46.07, 11.12, ['trentino', 'trento', 'trentodoc', 'trento doc', 'marzemino', 'nosiola', 'vino santo trentino'], 'Trentodoc (metodo classico), Marzemino, Nosiola e Vino Santo.'),
  Z('Italia', 'Trentino-Alto Adige', 'Teroldego Rotaliano', 46.21, 11.11, ['teroldego'], 'Teroldego dalla Piana Rotaliana.'),
  Z('Italia', 'Trentino-Alto Adige', 'Alto Adige', 46.5, 11.35, ['alto adige', 'sudtirol', 'sudtirolo', 'sudtiroler', 'bolzano', 'lagrein', 'santa maddalena', 'schiava', 'terlano', 'caldaro', 'valle isarco', 'val venosta'], 'Bianchi alpini (Pinot Bianco, Gewürztraminer, Sauvignon), Lagrein e Schiava.'),
  Z('Italia', 'Veneto', 'Veneto', 45.6, 11.9, ['veneto', 'delle venezie', 'venezie'], 'Dal Prosecco all’Amarone: spumanti, bianchi e grandi rossi.'),
  Z('Italia', 'Veneto', 'Valpolicella', 45.53, 10.87, ['valpolicella', 'amarone', 'ripasso', 'recioto della valpolicella'], 'Corvina, Corvinone e Rondinella. L’Amarone e il Recioto nascono da uve appassite.'),
  Z('Italia', 'Veneto', 'Soave', 45.42, 11.25, ['soave', 'recioto di soave'], 'Garganega su suoli vulcanici e calcarei.'),
  Z('Italia', 'Veneto', 'Bardolino', 45.55, 10.72, ['bardolino'], 'Rossi leggeri e il Chiaretto dalla sponda veronese del Garda.'),
  Z('Italia', 'Veneto', 'Custoza', 45.38, 10.79, ['custoza'], 'Bianco a base di Garganega, Trebbiano e Trebbianello.'),
  Z('Italia', 'Veneto', 'Conegliano Valdobbiadene', 45.9, 12.0, ['valdobbiadene', 'conegliano', 'cartizze', 'prosecco superiore', 'asolo'], 'DOCG del Prosecco Superiore, colline patrimonio UNESCO; Cartizze il cru.'),
  Z('Italia', 'Veneto', 'Prosecco', 45.75, 12.4, ['prosecco'], 'DOC Prosecco: Glera, metodo Martinotti, tra Veneto e Friuli.'),
  Z('Italia', 'Veneto', 'Colli Euganei', 45.3, 11.7, ['colli euganei', 'fior d arancio'], 'Colline vulcaniche: rossi bordolesi e Moscato Fior d’Arancio.'),
  Z('Italia', 'Veneto', 'Lessini Durello', 45.6, 11.3, ['durello', 'lessini'], 'Metodo classico da Durella, acidità altissima.'),
  Z('Italia', 'Veneto', 'Piave', 45.75, 12.4, ['piave', 'raboso', 'malanotte'], 'Raboso del Piave e Malanotte DOCG.'),
  Z('Italia', 'Friuli Venezia Giulia', 'Friuli Venezia Giulia', 46.0, 13.1, ['friuli', 'venezia giulia', 'delle venezie friuli'], 'Bianchi di carattere: Friulano, Ribolla Gialla, Malvasia; vini macerati.'),
  Z('Italia', 'Friuli Venezia Giulia', 'Collio', 45.95, 13.55, ['collio', 'oslavia', 'ribolla'], 'Colline di Gorizia: bianchi strutturati e Ribolla macerata di Oslavia.'),
  Z('Italia', 'Friuli Venezia Giulia', 'Friuli Colli Orientali', 46.07, 13.4, ['colli orientali', 'ramandolo', 'picolit', 'schioppettino', 'pignolo', 'refosco', 'rosazzo'], 'Friulano, Schioppettino, Refosco, Picolit e Ramandolo dolci.'),
  Z('Italia', 'Friuli Venezia Giulia', 'Carso', 45.75, 13.72, ['carso', 'vitovska', 'terrano', 'kras'], 'Vitovska e Terrano sulla roccia carsica sopra Trieste.'),
  Z('Italia', 'Friuli Venezia Giulia', 'Friuli Isonzo', 45.85, 13.47, ['isonzo'], 'Pianura ghiaiosa dell’Isonzo: bianchi pieni e rossi.'),
  Z('Italia', 'Friuli Venezia Giulia', 'Friuli Grave', 45.98, 12.85, ['friuli grave', 'grave del friuli'], 'La DOC più grande del Friuli, tra Pordenone e Udine.'),
  Z('Italia', 'Liguria', 'Liguria', 44.3, 8.7, ['liguria', 'ligure'], 'Vigne a terrazze sul mare: Vermentino, Pigato, Rossese.'),
  Z('Italia', 'Liguria', 'Cinque Terre', 44.12, 9.73, ['cinque terre', 'sciacchetra'], 'Bianchi da Bosco e Albarola; lo Sciacchetrà passito.'),
  Z('Italia', 'Liguria', 'Colli di Luni', 44.1, 9.98, ['colli di luni', 'luni'], 'Vermentino al confine con la Toscana.'),
  Z('Italia', 'Liguria', 'Riviera di Ponente', 43.95, 8.1, ['pigato', 'rossese', 'dolceacqua', 'riviera ligure di ponente', 'ormeasco'], 'Pigato, Vermentino e Rossese di Dolceacqua.'),
  Z('Italia', 'Emilia-Romagna', 'Emilia-Romagna', 44.5, 11.0, ['emilia romagna', 'emilia'], 'Lambrusco, Sangiovese di Romagna, Albana e i vini dei Colli Piacentini.'),
  Z('Italia', 'Emilia-Romagna', 'Lambrusco', 44.62, 10.92, ['lambrusco', 'sorbara', 'grasparossa', 'salamino'], 'Rossi frizzanti di Modena, Reggio e Parma.'),
  Z('Italia', 'Emilia-Romagna', 'Colli Piacentini', 44.87, 9.6, ['colli piacentini', 'gutturnio', 'ortrugo', 'malvasia di candia'], 'Gutturnio, Ortrugo e Malvasia di Candia, anche frizzanti.'),
  Z('Italia', 'Emilia-Romagna', 'Colli Bolognesi', 44.42, 11.2, ['colli bolognesi', 'pignoletto'], 'Pignoletto fermo e frizzante.'),
  Z('Italia', 'Emilia-Romagna', 'Romagna', 44.2, 11.9, ['romagna', 'albana', 'sangiovese di romagna', 'bertinoro'], 'Sangiovese di Romagna e Albana DOCG.'),
  Z('Italia', 'Toscana', 'Toscana', 43.4, 11.1, ['toscana', 'toscano', 'supertuscan', 'super tuscan', 'costa toscana'], 'Terra del Sangiovese, dal Chianti al Brunello, e dei Supertuscan.'),
  Z('Italia', 'Toscana', 'Chianti Classico', 43.47, 11.28, ['chianti classico', 'gallo nero', 'gran selezione', 'radda', 'gaiole', 'castellina in chianti', 'panzano', 'greve'], 'DOCG tra Firenze e Siena: Sangiovese in Annata, Riserva e Gran Selezione.'),
  Z('Italia', 'Toscana', 'Chianti', 43.65, 11.45, ['chianti', 'chianti rufina', 'rufina', 'colli senesi', 'colli fiorentini', 'montalbano'], 'DOCG con sette sottozone attorno al Chianti Classico; Rufina la più fresca.'),
  Z('Italia', 'Toscana', 'Montalcino', 43.06, 11.49, ['montalcino', 'brunello', 'sant antimo'], 'Brunello di Montalcino DOCG: Sangiovese in purezza, almeno 5 anni prima di uscire.'),
  Z('Italia', 'Toscana', 'Montepulciano', 43.1, 11.78, ['nobile di montepulciano', 'vino nobile', 'rosso di montepulciano'], 'Vino Nobile di Montepulciano DOCG, da Sangiovese (Prugnolo Gentile).'),
  Z('Italia', 'Toscana', 'Bolgheri', 43.23, 10.61, ['bolgheri', 'sassicaia', 'castagneto carducci'], 'Costa livornese: tagli bordolesi di Cabernet e Merlot.'),
  Z('Italia', 'Toscana', 'Maremma', 42.72, 11.15, ['maremma', 'morellino', 'scansano', 'montecucco', 'capalbio', 'pitigliano', 'sovana'], 'Morellino di Scansano, Montecucco e la Maremma toscana.'),
  Z('Italia', 'Toscana', 'San Gimignano', 43.47, 11.04, ['san gimignano', 'vernaccia'], 'Vernaccia di San Gimignano, il bianco DOCG toscano.'),
  Z('Italia', 'Toscana', 'Carmignano', 43.81, 11.01, ['carmignano'], 'DOCG storica: Sangiovese con Cabernet.'),
  Z('Italia', 'Toscana', 'Cortona', 43.27, 11.99, ['cortona'], 'Syrah e Sangiovese in Valdichiana.'),
  Z('Italia', 'Toscana', 'Isola d\'Elba', 42.78, 10.25, ['elba', 'aleatico'], 'Ansonica e Aleatico passito.'),
  Z('Italia', 'Umbria', 'Umbria', 42.95, 12.5, ['umbria'], 'Sagrantino di Montefalco e Orvieto.'),
  Z('Italia', 'Umbria', 'Montefalco', 42.89, 12.65, ['montefalco', 'sagrantino'], 'Sagrantino DOCG: il rosso italiano più tannico; anche passito.'),
  Z('Italia', 'Umbria', 'Orvieto', 42.72, 12.11, ['orvieto'], 'Bianco da Grechetto e Procanico, anche muffato.'),
  Z('Italia', 'Umbria', 'Torgiano', 43.03, 12.43, ['torgiano'], 'Rosso Riserva DOCG da Sangiovese.'),
  Z('Italia', 'Marche', 'Marche', 43.3, 13.2, ['marche'], 'Verdicchio, Montepulciano del Conero e Pecorino di Offida.'),
  Z('Italia', 'Marche', 'Castelli di Jesi', 43.52, 13.2, ['verdicchio', 'castelli di jesi', 'jesi'], 'Verdicchio dei Castelli di Jesi: bianco sapido, capace di invecchiare.'),
  Z('Italia', 'Marche', 'Matelica', 43.26, 13.0, ['matelica', 'verdicchio di matelica'], 'Verdicchio di montagna, più teso.'),
  Z('Italia', 'Marche', 'Conero', 43.5, 13.6, ['conero', 'rosso conero'], 'Montepulciano sul promontorio del Conero.'),
  Z('Italia', 'Marche', 'Offida e Piceno', 42.93, 13.69, ['offida', 'piceno', 'rosso piceno', 'pecorino offida', 'passerina'], 'Pecorino, Passerina e Rosso Piceno.'),
  Z('Italia', 'Lazio', 'Lazio', 41.9, 12.7, ['lazio'], 'Frascati, Cesanese e i bianchi dei Castelli Romani.'),
  Z('Italia', 'Lazio', 'Castelli Romani', 41.8, 12.68, ['frascati', 'castelli romani', 'marino'], 'Bianchi da Malvasia e Trebbiano sui colli vulcanici.'),
  Z('Italia', 'Lazio', 'Cesanese', 41.75, 13.12, ['cesanese', 'piglio', 'olevano'], 'Cesanese del Piglio DOCG.'),
  Z('Italia', 'Lazio', 'Montefiascone', 42.54, 12.03, ['est est est', 'montefiascone'], 'Est! Est!! Est!!! sul lago di Bolsena.'),
  Z('Italia', 'Abruzzo', 'Abruzzo', 42.2, 13.9, ['abruzzo'], 'Montepulciano d’Abruzzo, Trebbiano e Cerasuolo.'),
  Z('Italia', 'Abruzzo', 'Montepulciano d\'Abruzzo', 42.3, 14.0, ['montepulciano d abruzzo', 'colline teramane', 'cerasuolo d abruzzo'], 'Rosso generoso; il Cerasuolo è la versione rosata.'),
  Z('Italia', 'Abruzzo', 'Trebbiano d\'Abruzzo', 42.35, 14.15, ['trebbiano d abruzzo'], 'Bianco che nelle mani migliori invecchia a lungo.'),
  Z('Italia', 'Molise', 'Molise', 41.65, 14.6, ['molise', 'tintilia', 'biferno'], 'Tintilia, il vitigno autoctono.'),
  Z('Italia', 'Campania', 'Campania', 40.9, 14.8, ['campania'], 'Aglianico, Fiano, Greco e Falanghina: viticoltura antichissima e vulcanica.'),
  Z('Italia', 'Campania', 'Taurasi', 41.01, 14.96, ['taurasi'], 'DOCG: Aglianico d’Irpinia, il “Barolo del Sud”.'),
  Z('Italia', 'Campania', 'Fiano di Avellino', 40.95, 14.85, ['fiano di avellino', 'irpinia', 'lapio'], 'Bianco DOCG minerale, invecchia molto bene.'),
  Z('Italia', 'Campania', 'Greco di Tufo', 41.01, 14.82, ['greco di tufo'], 'Bianco DOCG sapido, sui terreni sulfurei di Tufo.'),
  Z('Italia', 'Campania', 'Sannio e Taburno', 41.2, 14.6, ['sannio', 'falanghina', 'taburno', 'aglianico del taburno', 'solopaca', 'guardiolo'], 'Falanghina del Sannio e Aglianico del Taburno.'),
  Z('Italia', 'Campania', 'Campi Flegrei', 40.85, 14.1, ['campi flegrei', 'piedirosso', 'per e palummo'], 'Falanghina e Piedirosso su sabbie vulcaniche, spesso a piede franco.'),
  Z('Italia', 'Campania', 'Vesuvio', 40.82, 14.43, ['vesuvio', 'lacryma christi'], 'Lacryma Christi sulle pendici del vulcano.'),
  Z('Italia', 'Campania', 'Costa d\'Amalfi', 40.65, 14.6, ['costa d amalfi', 'furore', 'ravello', 'tramonti'], 'Vigne a strapiombo sul mare, Fenile, Ginestra e Tintore.'),
  Z('Italia', 'Campania', 'Ischia', 40.73, 13.9, ['ischia', 'biancolella', 'forastera'], 'Biancolella e Forastera dell’isola.'),
  Z('Italia', 'Campania', 'Cilento', 40.3, 15.2, ['cilento', 'paestum'], 'Fiano e Aglianico del Cilento.'),
  Z('Italia', 'Puglia', 'Puglia', 40.9, 16.7, ['puglia', 'primitivo', 'negroamaro', 'nero di troia'], 'Primitivo, Negroamaro e Nero di Troia; rosati di tradizione.'),
  Z('Italia', 'Puglia', 'Manduria', 40.4, 17.63, ['manduria', 'primitivo di manduria'], 'Primitivo di Manduria: rossi caldi e generosi, anche dolci naturali.'),
  Z('Italia', 'Puglia', 'Salento', 40.38, 17.96, ['salento', 'salice salentino', 'squinzano', 'leverano', 'copertino', 'brindisi'], 'Negroamaro, Malvasia Nera e rosati.'),
  Z('Italia', 'Puglia', 'Castel del Monte', 41.08, 16.27, ['castel del monte', 'bombino'], 'Nero di Troia e Bombino nelle Murge.'),
  Z('Italia', 'Puglia', 'Gioia del Colle', 40.8, 16.92, ['gioia del colle'], 'Primitivo d’altura, più fresco.'),
  Z('Italia', 'Basilicata', 'Basilicata', 40.6, 16.0, ['basilicata', 'lucania'], 'Aglianico del Vulture e Matera.'),
  Z('Italia', 'Basilicata', 'Vulture', 40.95, 15.63, ['vulture', 'aglianico del vulture', 'rionero', 'barile'], 'Aglianico sui suoli vulcanici del Vulture.'),
  Z('Italia', 'Calabria', 'Calabria', 39.0, 16.4, ['calabria', 'gaglioppo', 'magliocco', 'greco di bianco'], 'Gaglioppo, Magliocco e il dolce Greco di Bianco.'),
  Z('Italia', 'Calabria', 'Cirò', 39.38, 17.06, ['ciro'], 'Gaglioppo della costa ionica.'),
  Z('Italia', 'Sicilia', 'Sicilia', 37.6, 14.0, ['sicilia', 'sicilia doc', 'terre siciliane', 'nero d avola', 'grillo', 'catarratto'], 'Nero d’Avola, Grillo, Catarratto e i vini dell’Etna.'),
  Z('Italia', 'Sicilia', 'Etna', 37.75, 15.0, ['etna', 'nerello mascalese', 'carricante', 'contrada'], 'Nerello Mascalese e Carricante sul vulcano, fino a 1000 m.'),
  Z('Italia', 'Sicilia', 'Vittoria', 36.95, 14.53, ['cerasuolo di vittoria', 'vittoria', 'frappato'], 'Cerasuolo di Vittoria DOCG: Nero d’Avola e Frappato.'),
  Z('Italia', 'Sicilia', 'Noto ed Eloro', 36.89, 15.07, ['eloro', 'moscato di noto', 'pachino'], 'Nero d’Avola nella sua culla e Moscato di Noto.'),
  Z('Italia', 'Sicilia', 'Faro', 38.25, 15.6, ['faro'], 'Piccola DOC di Messina sullo Stretto.'),
  Z('Italia', 'Sicilia', 'Marsala', 37.8, 12.43, ['marsala'], 'Vino fortificato storico, da Grillo, Inzolia e Catarratto.'),
  Z('Italia', 'Sicilia', 'Pantelleria', 36.83, 11.95, ['pantelleria', 'passito di pantelleria', 'zibibbo'], 'Zibibbo ad alberello, patrimonio UNESCO; il Passito.'),
  Z('Italia', 'Sicilia', 'Sicilia occidentale', 37.6, 12.97, ['menfi', 'contessa entellina', 'sambuca di sicilia', 'alcamo', 'santa margherita di belice'], 'Menfi, Contessa Entellina, Alcamo.'),
  Z('Italia', 'Sicilia', 'Isole Eolie', 38.5, 14.95, ['malvasia delle lipari', 'lipari', 'salina', 'eolie'], 'Malvasia delle Lipari passita.'),
  Z('Italia', 'Sardegna', 'Sardegna', 40.0, 9.0, ['sardegna', 'isola dei nuraghi'], 'Cannonau, Vermentino, Carignano e Vernaccia di Oristano.'),
  Z('Italia', 'Sardegna', 'Cannonau di Sardegna', 40.1, 9.4, ['cannonau', 'mamoiada', 'jerzu', 'oliena', 'nepente'], 'Cannonau (Grenache) della Barbagia e dell’Ogliastra.'),
  Z('Italia', 'Sardegna', 'Gallura', 40.95, 9.3, ['gallura', 'vermentino di gallura'], 'Vermentino di Gallura DOCG su graniti.'),
  Z('Italia', 'Sardegna', 'Sulcis', 39.1, 8.5, ['sulcis', 'carignano del sulcis'], 'Carignano ad alberello su sabbie.'),
  Z('Italia', 'Sardegna', 'Oristano', 39.9, 8.6, ['vernaccia di oristano', 'oristano', 'malvasia di bosa', 'bosa'], 'Vernaccia di Oristano ossidativa e Malvasia di Bosa.'),
  // ---------- FRANCIA (regioni vinicole) ----------
  Z('Francia', '', 'Francia', 46.6, 2.4, ['francia', 'france', 'vin de france'], 'Bordeaux, Borgogna, Champagne, Rodano, Loira, Alsazia e il Sud.'),
  Z('Francia', 'Champagne', 'Champagne', 49.05, 4.0, ['champagne', 'reims', 'epernay', 'montagne de reims', 'cote des blancs', 'vallee de la marne', 'cote des bar', 'ay', 'cramant', 'avize', 'le mesnil', 'bouzy', 'coteaux champenois'], 'Metodo classico da Chardonnay, Pinot Noir e Meunier su gessi.'),
  Z('Francia', 'Alsazia', 'Alsazia', 48.15, 7.3, ['alsace', 'alsazia', 'cremant d alsace'], 'Riesling, Gewurztraminer, Pinot Gris e Muscat; 51 Grand Cru.'),
  Z('Francia', 'Borgogna', 'Borgogna', 47.0, 4.7, ['bourgogne', 'borgogna', 'burgundy', 'cremant de bourgogne', 'hautes cotes'], 'Pinot Noir e Chardonnay; il concetto di climat e cru.'),
  Z('Francia', 'Borgogna', 'Chablis', 47.81, 3.8, ['chablis'], 'Chardonnay su marne kimmeridgiane: teso e minerale.'),
  Z('Francia', 'Borgogna', 'Côte de Nuits', 47.18, 4.97, ['cote de nuits', 'gevrey', 'chambertin', 'vosne', 'romanee', 'nuits saint georges', 'morey', 'chambolle', 'musigny', 'vougeot', 'marsannay', 'fixin', 'echezeaux', 'clos de tart', 'la tache'], 'Il cuore del Pinot Noir: Gevrey, Chambolle, Vosne-Romanée.'),
  Z('Francia', 'Borgogna', 'Côte de Beaune', 47.0, 4.78, ['cote de beaune', 'beaune', 'pommard', 'volnay', 'meursault', 'puligny', 'chassagne', 'montrachet', 'corton', 'aloxe', 'savigny', 'santenay', 'saint aubin', 'auxey', 'monthelie', 'pernand', 'ladoix', 'saint romain'], 'Grandi bianchi (Meursault, Montrachet) e rossi (Pommard, Volnay, Corton).'),
  Z('Francia', 'Borgogna', 'Côte Chalonnaise', 46.78, 4.7, ['mercurey', 'givry', 'rully', 'montagny', 'bouzeron', 'chalonnaise'], 'Rully, Mercurey e Givry: Borgogna più accessibile.'),
  Z('Francia', 'Borgogna', 'Mâconnais', 46.3, 4.78, ['macon', 'maconnais', 'pouilly fuisse', 'saint veran', 'vire clesse', 'pouilly vinzelles'], 'Chardonnay del sud: Pouilly-Fuissé e Saint-Véran.'),
  Z('Francia', 'Beaujolais', 'Beaujolais', 46.15, 4.65, ['beaujolais', 'morgon', 'fleurie', 'moulin a vent', 'brouilly', 'julienas', 'chenas', 'chiroubles', 'regnie', 'saint amour', 'cote de brouilly'], 'Gamay su graniti; dieci cru come Morgon, Fleurie e Moulin-à-Vent.'),
  Z('Francia', 'Valle del Rodano', 'Valle del Rodano', 44.6, 4.8, ['cotes du rhone', 'cote du rhone', 'rhone', 'rodano', 'ventoux', 'luberon', 'costieres de nimes'], 'Syrah al nord, Grenache e assemblaggi al sud.'),
  Z('Francia', 'Valle del Rodano', 'Côte-Rôtie e Condrieu', 45.47, 4.8, ['cote rotie', 'condrieu', 'chateau grillet'], 'Syrah sui pendii della Côte-Rôtie, Viognier a Condrieu.'),
  Z('Francia', 'Valle del Rodano', 'Hermitage', 45.07, 4.85, ['hermitage', 'crozes', 'saint joseph', 'cornas', 'saint peray'], 'Syrah di Hermitage, Cornas, Saint-Joseph e Crozes-Hermitage.'),
  Z('Francia', 'Valle del Rodano', 'Châteauneuf-du-Pape', 44.06, 4.83, ['chateauneuf', 'gigondas', 'vacqueyras', 'lirac', 'tavel', 'rasteau', 'cairanne', 'vinsobres', 'beaumes de venise'], 'Grenache, Syrah e Mourvèdre su ciottoli: Châteauneuf, Gigondas, Vacqueyras.'),
  Z('Francia', 'Valle della Loira', 'Valle della Loira', 47.3, 0.5, ['loire', 'loira', 'val de loire', 'cremant de loire'], 'Chenin, Sauvignon, Cabernet Franc e Muscadet lungo il fiume.'),
  Z('Francia', 'Valle della Loira', 'Muscadet', 47.15, -1.4, ['muscadet'], 'Melon de Bourgogne sur lie vicino all’Atlantico.'),
  Z('Francia', 'Valle della Loira', 'Anjou e Saumur', 47.3, -0.4, ['anjou', 'saumur', 'savennieres', 'coteaux du layon', 'bonnezeaux', 'quarts de chaume'], 'Chenin secco e dolce, Cabernet Franc di Saumur-Champigny.'),
  Z('Francia', 'Valle della Loira', 'Touraine', 47.3, 0.6, ['touraine', 'vouvray', 'chinon', 'bourgueil', 'montlouis'], 'Vouvray e Montlouis (Chenin), Chinon e Bourgueil (Cabernet Franc).'),
  Z('Francia', 'Valle della Loira', 'Sancerre e Pouilly', 47.3, 2.88, ['sancerre', 'pouilly fume', 'menetou', 'quincy', 'reuilly'], 'Sauvignon Blanc su selce e calcare.'),
  Z('Francia', 'Bordeaux', 'Bordeaux', 44.84, -0.58, ['bordeaux', 'bordeaux superieur', 'cotes de bordeaux', 'blaye', 'bourg'], 'Tagli di Cabernet e Merlot; i grandi Château.'),
  Z('Francia', 'Bordeaux', 'Médoc', 45.15, -0.75, ['medoc', 'pauillac', 'margaux', 'saint julien', 'saint estephe', 'haut medoc', 'listrac', 'moulis'], 'Riva sinistra: Cabernet Sauvignon a Pauillac, Margaux, Saint-Julien.'),
  Z('Francia', 'Bordeaux', 'Graves e Pessac-Léognan', 44.75, -0.6, ['graves', 'pessac', 'leognan'], 'Rossi e grandi bianchi da Sauvignon e Sémillon.'),
  Z('Francia', 'Bordeaux', 'Sauternes', 44.53, -0.34, ['sauternes', 'barsac'], 'Bianchi dolci da uve con muffa nobile.'),
  Z('Francia', 'Bordeaux', 'Saint-Émilion e Pomerol', 44.9, -0.17, ['saint emilion', 'pomerol', 'fronsac', 'lalande', 'castillon'], 'Riva destra: Merlot e Cabernet Franc.'),
  Z('Francia', 'Bordeaux', 'Entre-Deux-Mers', 44.75, -0.3, ['entre deux mers'], 'Bianchi freschi tra Garonna e Dordogna.'),
  Z('Francia', 'Sud-Ovest', 'Sud-Ovest', 44.0, 0.8, ['sud ouest', 'sud ovest', 'irouleguy', 'marcillac', 'cotes de gascogne', 'gascogne'], 'Malbec, Tannat e uve antiche della Guascogna.'),
  Z('Francia', 'Sud-Ovest', 'Cahors', 44.45, 1.44, ['cahors'], 'Malbec scuro e tannico.'),
  Z('Francia', 'Sud-Ovest', 'Madiran', 43.55, -0.05, ['madiran', 'pacherenc'], 'Tannat potente.'),
  Z('Francia', 'Sud-Ovest', 'Jurançon', 43.3, -0.4, ['jurancon'], 'Petit e Gros Manseng, secco e dolce.'),
  Z('Francia', 'Sud-Ovest', 'Bergerac', 44.85, 0.48, ['bergerac', 'monbazillac', 'pecharmant'], 'Tagli bordolesi e il dolce Monbazillac.'),
  Z('Francia', 'Sud-Ovest', 'Gaillac', 43.9, 1.9, ['gaillac'], 'Vitigni rari come Mauzac, Braucol e Len de l’El.'),
  Z('Francia', 'Linguadoca-Rossiglione', 'Linguadoca-Rossiglione', 43.3, 3.0, ['languedoc', 'roussillon', 'pays d oc', 'igp oc'], 'Grenache, Syrah, Carignan e Mourvèdre del Midi.'),
  Z('Francia', 'Linguadoca-Rossiglione', 'Languedoc', 43.55, 3.5, ['pic saint loup', 'faugeres', 'saint chinian', 'minervois', 'corbieres', 'terrasses du larzac', 'la clape', 'picpoul', 'limoux', 'fitou'], 'Pic Saint-Loup, Terrasses du Larzac, Minervois, Corbières.'),
  Z('Francia', 'Linguadoca-Rossiglione', 'Roussillon', 42.65, 2.8, ['banyuls', 'collioure', 'maury', 'rivesaltes', 'cotes catalanes', 'cotes du roussillon'], 'Rossi del sud e i dolci naturali di Banyuls e Maury.'),
  Z('Francia', 'Provenza', 'Provenza', 43.45, 6.1, ['provence', 'provenza', 'cotes de provence', 'bandol', 'cassis', 'palette', 'bellet', 'coteaux d aix', 'baux de provence'], 'Rosati, Mourvèdre di Bandol e i bianchi di Cassis.'),
  Z('Francia', 'Jura', 'Jura', 46.75, 5.7, ['jura', 'arbois', 'vin jaune', 'chateau chalon', 'l etoile', 'cotes du jura'], 'Savagnin, Vin Jaune sotto velo, Poulsard e Trousseau.'),
  Z('Francia', 'Savoia', 'Savoia', 45.55, 6.0, ['savoie', 'savoia', 'apremont', 'chignin', 'roussette', 'mondeuse', 'jacquere'], 'Jacquère, Altesse e Mondeuse alpini.'),
  Z('Francia', 'Corsica', 'Corsica', 42.15, 9.1, ['corse', 'corsica', 'patrimonio', 'ajaccio', 'sciaccarellu', 'niellucciu'], 'Niellucciu, Sciaccarellu e Vermentinu.'),
  // ---------- ALTRI PAESI ----------
  Z('Spagna', '', 'Spagna', 40.2, -3.7, ['spagna', 'spain', 'espana', 'vino de espana'], 'Tempranillo, Garnacha, Albariño e i vini fortificati di Jerez.'),
  Z('Spagna', '', 'Rioja', 42.47, -2.45, ['rioja'], 'Tempranillo: Crianza, Reserva, Gran Reserva.'),
  Z('Spagna', '', 'Ribera del Duero', 41.63, -3.7, ['ribera del duero'], 'Tempranillo (Tinto Fino) potente sull’altopiano.'),
  Z('Spagna', '', 'Toro', 41.52, -5.4, ['toro'], 'Tinta de Toro molto concentrata.'),
  Z('Spagna', '', 'Rueda', 41.41, -4.96, ['rueda', 'verdejo'], 'Verdejo fresco e aromatico.'),
  Z('Spagna', '', 'Bierzo', 42.6, -6.8, ['bierzo', 'mencia'], 'Mencía su ardesia.'),
  Z('Spagna', '', 'Rías Baixas', 42.4, -8.7, ['rias baixas', 'albarino'], 'Albariño atlantico in Galizia.'),
  Z('Spagna', '', 'Priorat', 41.2, 0.8, ['priorat', 'montsant'], 'Garnacha e Cariñena su ardesia (llicorella).'),
  Z('Spagna', '', 'Penedès', 41.35, 1.7, ['penedes', 'cava', 'corpinnat', 'classic penedes'], 'Patria del Cava e del Corpinnat.'),
  Z('Spagna', '', 'Jerez', 36.68, -6.13, ['jerez', 'sherry', 'xeres', 'manzanilla', 'fino', 'amontillado', 'oloroso', 'palo cortado', 'pedro ximenez'], 'Vini fortificati: Fino, Manzanilla, Amontillado, Oloroso.'),
  Z('Portogallo', '', 'Portogallo', 39.6, -8.0, ['portogallo', 'portugal'], 'Porto, Douro, Vinho Verde, Alentejo e Madeira.'),
  Z('Portogallo', '', 'Douro', 41.16, -7.6, ['douro', 'porto', 'port'], 'Rossi del Douro e Porto fortificato.'),
  Z('Portogallo', '', 'Vinho Verde', 41.7, -8.4, ['vinho verde', 'alvarinho', 'loureiro'], 'Bianchi freschi, leggermente frizzanti.'),
  Z('Portogallo', '', 'Dão', 40.6, -7.9, ['dao', 'encruzado'], 'Touriga Nacional ed Encruzado su granito.'),
  Z('Portogallo', '', 'Alentejo', 38.6, -7.9, ['alentejo'], 'Rossi caldi e maturi; anfore di terracotta (talha).'),
  Z('Portogallo', '', 'Madeira', 32.75, -16.95, ['madeira', 'madera'], 'Vino fortificato ossidativo, quasi eterno.'),
  Z('Germania', '', 'Germania', 50.5, 8.0, ['germania', 'germany', 'deutschland'], 'Riesling in tutte le versioni, Spätburgunder (Pinot Nero).'),
  Z('Germania', '', 'Mosella', 49.92, 7.0, ['mosel', 'mosella', 'saar', 'ruwer'], 'Riesling su ardesia, leggeri e tesi.'),
  Z('Germania', '', 'Rheingau', 50.0, 8.05, ['rheingau'], 'Riesling più pieni, di grandi tenute storiche.'),
  Z('Germania', '', 'Nahe', 49.85, 7.85, ['nahe'], 'Riesling su suoli vari e vulcanici.'),
  Z('Germania', '', 'Pfalz', 49.35, 8.15, ['pfalz', 'palatinato'], 'Riesling secchi e Spätburgunder.'),
  Z('Germania', '', 'Rheinhessen', 49.8, 8.2, ['rheinhessen', 'reno', 'rhein'], 'La zona più vasta; Riesling di Roter Hang.'),
  Z('Germania', '', 'Baden', 48.3, 7.8, ['baden', 'kaiserstuhl'], 'Pinot Nero e Pinot Grigio, la zona più calda.'),
  Z('Germania', '', 'Franken', 49.8, 10.0, ['franken', 'franconia', 'bocksbeutel'], 'Silvaner nella Bocksbeutel.'),
  Z('Austria', '', 'Austria', 47.6, 14.5, ['austria', 'osterreich'], 'Grüner Veltliner, Riesling e rossi da Blaufränkisch.'),
  Z('Austria', '', 'Wachau', 48.36, 15.42, ['wachau', 'kamptal', 'kremstal', 'smaragd', 'federspiel'], 'Grüner Veltliner e Riesling sul Danubio.'),
  Z('Austria', '', 'Burgenland', 47.75, 16.75, ['burgenland', 'neusiedlersee', 'blaufrankisch', 'ruster ausbruch'], 'Blaufränkisch e dolci botritizzati.'),
  Z('Austria', '', 'Steiermark', 46.75, 15.55, ['steiermark', 'stiria'], 'Sauvignon Blanc della Stiria.'),
  Z('Svizzera', '', 'Svizzera', 46.6, 7.8, ['svizzera', 'suisse', 'vallese', 'valais', 'vaud', 'lavaux', 'chasselas'], 'Chasselas, Petite Arvine e Pinot Noir.'),
  Z('Slovenia', '', 'Slovenia', 46.0, 13.6, ['slovenia', 'brda', 'vipava'], 'Brda e Vipava, oltre il confine del Collio.'),
  Z('Croazia', '', 'Croazia', 45.2, 13.9, ['croazia', 'istria', 'malvazija', 'teran', 'plavac'], 'Malvazija istriana, Teran e Plavac Mali.'),
  Z('Ungheria', '', 'Tokaj', 48.12, 21.4, ['tokaj', 'tokaji', 'aszu', 'furmint', 'ungheria'], 'Tokaji Aszú dolce e Furmint secco.'),
  Z('Grecia', '', 'Grecia', 38.5, 23.0, ['grecia', 'santorini', 'assyrtiko', 'naoussa', 'xinomavro', 'nemea'], 'Assyrtiko di Santorini, Xinomavro di Naoussa.'),
  Z('Georgia', '', 'Georgia', 41.8, 45.0, ['georgia', 'kakheti', 'qvevri', 'saperavi', 'rkatsiteli'], 'Vini in qvevri (anfore interrate), Saperavi e Rkatsiteli.'),
  Z('Libano', '', 'Libano', 33.85, 35.9, ['libano', 'bekaa', 'lebanon'], 'Valle della Bekaa.'),
  Z('Stati Uniti', '', 'Stati Uniti', 39.5, -98.0, ['stati uniti', 'usa', 'america'], 'California, Oregon, Washington e New York.'),
  Z('Stati Uniti', '', 'Napa Valley', 38.5, -122.36, ['napa'], 'Cabernet Sauvignon della California.'),
  Z('Stati Uniti', '', 'Sonoma', 38.45, -122.8, ['sonoma', 'russian river'], 'Pinot Noir, Chardonnay e Zinfandel.'),
  Z('Stati Uniti', '', 'California', 36.8, -120.5, ['california', 'paso robles', 'santa barbara', 'santa rita hills', 'central coast', 'lodi'], 'Dalla costa fresca alle valli calde.'),
  Z('Stati Uniti', '', 'Oregon', 45.2, -123.1, ['oregon', 'willamette'], 'Pinot Noir della Willamette Valley.'),
  Z('Stati Uniti', '', 'Washington', 46.3, -119.5, ['washington', 'columbia valley', 'walla walla'], 'Syrah, Cabernet e Riesling dell’entroterra.'),
  Z('Argentina', '', 'Argentina', -34.0, -64.0, ['argentina'], 'Malbec d’altitudine e Torrontés.'),
  Z('Argentina', '', 'Mendoza', -33.0, -68.8, ['mendoza', 'uco', 'lujan de cuyo'], 'Malbec ai piedi delle Ande.'),
  Z('Argentina', '', 'Salta', -25.9, -66.0, ['salta', 'cafayate', 'torrontes'], 'Torrontés e vigne tra le più alte al mondo.'),
  Z('Cile', '', 'Cile', -34.6, -71.0, ['cile', 'chile', 'maipo', 'colchagua', 'casablanca', 'maule', 'itata', 'aconcagua'], 'Cabernet Sauvignon, Carmenère, Sauvignon Blanc.'),
  Z('Australia', '', 'Australia', -33.0, 140.0, ['australia', 'mclaren vale', 'margaret river', 'yarra', 'clare valley', 'eden valley', 'hunter valley', 'tasmania'], 'Shiraz, Riesling della Clare Valley, Chardonnay di Margaret River.'),
  Z('Australia', '', 'Barossa', -34.55, 138.95, ['barossa'], 'Shiraz potente da vigne molto vecchie.'),
  Z('Nuova Zelanda', '', 'Nuova Zelanda', -41.5, 173.9, ['nuova zelanda', 'new zealand', 'marlborough', 'central otago', 'hawke s bay'], 'Sauvignon di Marlborough e Pinot Nero di Central Otago.'),
  Z('Sudafrica', '', 'Sudafrica', -33.9, 18.9, ['sudafrica', 'south africa', 'stellenbosch', 'swartland', 'franschhoek', 'constantia', 'paarl'], 'Chenin Blanc, Pinotage e Cabernet.'),
];
const UMB = new Set(REGIONS.filter((r) => r.n === r.g).map((r) => r.n));
const regLevel = (r) => (r.n === r.p ? 0 : r.n === r.g ? 1 : 2);
const REG_RX = REGIONS.map((r) => r.k.map((k) => ({ k, rx: new RegExp('(^|[^a-z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])') })));
// la zona più specifica vince; a parità, la parola riconosciuta più lunga
function matchRegion(text) {
  const t = nrm(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return -1;
  let best = -1, lvl = -1, len = 0;
  REG_RX.forEach((ks, i) => ks.forEach((x) => {
    if (!x.rx.test(t)) return;
    const l = regLevel(REGIONS[i]);
    if (l > lvl || (l === lvl && x.k.length > len)) { best = i; lvl = l; len = x.k.length; }
  }));
  return best;
}
function regionGroups() {
  const g = new Map(), un = [];
  Object.values(S.bottles).filter((b) => inCellar(b)).forEach((b) => {
    const i = matchRegion(b.region);
    if (i < 0) un.push(b); else { if (!g.has(i)) g.set(i, []); g.get(i).push(b); }
  });
  return { g, un };
}

/* ---------- confini ---------- */
const GEO = {};
const GEO_FILES = { world: 'geo/world.json', Italia: 'geo/it.json', Francia: 'geo/fr.json' };
// Francia: le regioni vinicole sono disegnate unendo i dipartimenti
const FR_GROUPS = {
  'Champagne': ['Marne', 'Aube', 'Aisne'],
  'Alsazia': ['Bas-Rhin', 'Haut-Rhin'],
  'Borgogna': ['Yonne', 'Côte-d\'Or', 'Saône-et-Loire'],
  'Beaujolais': ['Rhône'],
  'Valle del Rodano': ['Rhône', 'Loire', 'Drôme', 'Ardèche', 'Vaucluse', 'Gard'],
  'Valle della Loira': ['Loire-Atlantique', 'Maine-et-Loire', 'Indre-et-Loire', 'Loir-et-Cher', 'Cher', 'Nièvre', 'Loiret', 'Vienne', 'Deux-Sèvres'],
  'Bordeaux': ['Gironde'],
  'Sud-Ovest': ['Dordogne', 'Lot', 'Lot-et-Garonne', 'Tarn', 'Gers', 'Pyrénées-Atlantiques', 'Tarn-et-Garonne', 'Haute-Garonne', 'Landes', 'Aveyron', 'Hautes-Pyrénées'],
  'Linguadoca-Rossiglione': ['Hérault', 'Aude', 'Pyrénées-Orientales', 'Gard'],
  'Provenza': ['Var', 'Bouches-du-Rhône', 'Alpes-Maritimes'],
  'Jura': ['Jura'],
  'Savoia': ['Savoie', 'Haute-Savoie'],
  'Corsica': ['Corse-du-Sud', 'Haute-Corse'],
};
async function geo(k) {
  if (GEO[k]) return GEO[k];
  const r = await fetch(GEO_FILES[k]);
  if (!r.ok) throw new Error('geo');
  GEO[k] = await r.json();
  return GEO[k];
}
function inRings(x, y, rings) {
  for (const r of rings) {
    let ins = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    if (ins) return true;
  }
  return false;
}
// provincia (Italia) o dipartimento (Francia) in cui cade una zona
const subCache = new Map();
function subOf(i) {
  const r = REGIONS[i];
  if (regLevel(r) < 2 || !GEO[r.p] || !GEO[r.p].subs) return '';
  if (subCache.has(i)) return subCache.get(i);
  const s = GEO[r.p].subs.find((x) => inRings(r.lo, r.la, x.r));
  subCache.set(i, s ? s.n : '');
  return s ? s.n : '';
}

/* ---------- proiezione e disegno ---------- */
function bbox(ringsList) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  ringsList.forEach((rings) => rings.forEach((r) => r.forEach(([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; })));
  return [x0, y0, x1, y1];
}
function projector(b, W, H, pad) {
  const [x0, y0, x1, y1] = b, k = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const w = (x1 - x0) * k || 1, h = (y1 - y0) || 1;
  const s = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2;
  return ([x, y]) => [ox + (x - x0) * k * s, oy + (y1 - y) * s];
}
function pathOf(rings, P) {
  return rings.map((r) => 'M' + r.map((p) => P(p).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z').join('');
}
function shade(n, max) { if (!n) return ''; const t = Math.min(1, 0.35 + 0.65 * (n / Math.max(1, max))); return `fill-opacity:${t.toFixed(2)}`; }

let mPath = [];          // [] mondo · ['Italia'] paese · ['Italia','Toscana'] regione
let mPick = null;        // { kind: 'z', i } zona  ·  { kind: 's', n } provincia/dipartimento
let mapObj = null, selRegion = null;
function killMap() {}

function mapData() {
  const { g, un } = regionGroups();
  const zones = [...g.entries()].map(([i, bs]) => ({ i, r: REGIONS[i], bs }));
  return { zones, un };
}
const countOf = (zs) => zs.reduce((t, z) => t + z.bs.length, 0);

function crumbs() {
  const items = [['Mondo', 0]].concat(mPath.map((p, k) => [p, k + 1]));
  return '<div class="mcrumb">' + items.map(([t, k], j) => j === items.length - 1 && !mPick ? `<b>${esc(t)}</b>` : `<button data-a="mup" data-k="${k}">${esc(t)}</button>`).join('<span>›</span>')
    + (mPick ? `<span>›</span><b>${esc(mPick.kind === 'z' ? REGIONS[mPick.i].n : mPick.n)}</b>` : '') + '</div>';
}

function bottleRows(bs) {
  return bs.slice().sort((a, b) => name(a).localeCompare(name(b), 'it') || (a.vintage || 0) - (b.vintage || 0))
    .map((b) => `<button class="row" data-a="open" data-id="${esc(b.id)}"><span class="mrow">${imgSrc(b) ? `<img class="th" src="${imgSrc(b)}" alt="">` : `<span class="th t-${esc(b.type)}"></span>`}<span>${esc(name(b))} ${esc(b.vintage || '')}<small>${esc(b.region || '')}</small></span></span><span>${eur(b.value ?? b.price)}</span></button>`).join('');
}
function areaRows(rows) {
  return rows.sort((a, b) => b.n - a.n || a.t.localeCompare(b.t, 'it')).map((x) => `<button class="row" data-a="${x.a}" ${x.attr}><span>${esc(x.t)}${x.s ? `<small>${esc(x.s)}</small>` : ''}</span><span class="mcount">${x.n}</span></button>`).join('');
}

function mappa() {
  const { zones, un } = mapData();
  if (!zones.length && !un.length) return '<p class="empty">Aggiungi qualche bottiglia con la zona e la vedrai sulla mappa.</p>';
  return crumbs() + '<div id="map" class="smap"><p class="info" style="padding:16px">Carico la mappa…</p></div><div id="mpanel">' + mapPanel(zones, un) + '</div>';
}

function mapPanel(zones, un) {
  const [P, G] = mPath;
  if (mPick && mPick.kind === 'z') {
    const r = REGIONS[mPick.i], z = zones.find((x) => x.i === mPick.i);
    const bs = z ? z.bs : [];
    return `<div class="mcard"><h3>${esc(r.n)}</h3><p class="msub">${esc([r.g && r.g !== r.n ? r.g : '', subOf(mPick.i), r.p].filter(Boolean).join(' · '))}</p><p>${esc(r.i)}</p></div>`
      + `<h3 class="letter">${bs.length ? bs.length + (bs.length === 1 ? ' bottiglia' : ' bottiglie') : 'Nessuna bottiglia in cantina'}</h3>` + bottleRows(bs);
  }
  if (mPick && mPick.kind === 's') {
    const inS = zones.filter((z) => z.r.p === P && z.r.g === G && subOf(z.i) === mPick.n);
    const bs = inS.flatMap((z) => z.bs);
    return `<div class="mcard"><h3>${esc(mPick.n)}</h3><p class="msub">${esc(G)} · ${esc(P)}</p>${inS.length ? '' : '<p>Nessuna bottiglia da questa zona.</p>'}</div>`
      + (inS.length > 1 ? '<h3 class="letter">Denominazioni</h3>' + areaRows(inS.map((z) => ({ a: 'mzone', attr: `data-i="${z.i}"`, t: z.r.n, n: z.bs.length }))) : '')
      + (bs.length ? `<h3 class="letter">${bs.length} ${bs.length === 1 ? 'bottiglia' : 'bottiglie'}</h3>` + bottleRows(bs) : '');
  }
  if (!P) {
    const by = new Map();
    zones.forEach((z) => by.set(z.r.p, (by.get(z.r.p) || 0) + z.bs.length));
    return '<h3 class="letter">Paesi</h3>' + areaRows([...by.entries()].map(([p, n]) => ({ a: 'mgo', attr: `data-p="${esc(p)}"`, t: p, n })))
      + (un.length ? `<h3 class="letter">Zona non riconosciuta</h3><p class="info">${un.length} ${un.length === 1 ? 'bottiglia' : 'bottiglie'} con una zona che non conosco: scrivi nella scheda la denominazione (per esempio «Chianti Classico» o «Pauillac») e comparirà qui.</p>` + bottleRows(un) : '');
  }
  const inP = zones.filter((z) => z.r.p === P);
  const cz = REGIONS.find((r) => r.n === P && r.p === P);
  if (!G) {
    const hasGroups = inP.some((z) => z.r.g);
    let h = cz ? `<div class="mcard"><h3>${esc(P)}</h3><p>${esc(cz.i)}</p></div>` : '';
    if (hasGroups) {
      const by = new Map();
      inP.filter((z) => z.r.g).forEach((z) => by.set(z.r.g, (by.get(z.r.g) || 0) + z.bs.length));
      h += `<h3 class="letter">${P === 'Italia' ? 'Regioni' : 'Regioni vinicole'}</h3>` + areaRows([...by.entries()].map(([g, n]) => ({ a: 'mgo', attr: `data-g="${esc(g)}"`, t: g, n })));
    } else {
      h += '<h3 class="letter">Zone</h3>' + areaRows(inP.filter((z) => regLevel(z.r) > 0).map((z) => ({ a: 'mzone', attr: `data-i="${z.i}"`, t: z.r.n, n: z.bs.length })));
    }
    const gen = inP.filter((z) => regLevel(z.r) === 0).flatMap((z) => z.bs);
    if (gen.length) h += `<h3 class="letter">Senza zona precisa</h3>` + bottleRows(gen);
    return h;
  }
  const inG = inP.filter((z) => z.r.g === G);
  const gz = REGIONS.find((r) => r.p === P && r.n === G);
  let h = gz ? `<div class="mcard"><h3>${esc(G)}</h3><p>${esc(gz.i)}</p></div>` : '';
  const den = inG.filter((z) => regLevel(z.r) === 2);
  if (den.length) h += '<h3 class="letter">Denominazioni</h3>' + areaRows(den.map((z) => ({ a: 'mzone', attr: `data-i="${z.i}"`, t: z.r.n, s: subOf(z.i), n: z.bs.length })));
  const gen = inG.filter((z) => regLevel(z.r) === 1).flatMap((z) => z.bs);
  if (gen.length) h += `<h3 class="letter">${esc(G)} generico</h3>` + bottleRows(gen);
  return h;
}

async function initMap() {
  const el = document.getElementById('map');
  if (!el) return;
  const [P, G] = mPath;
  try {
    await geo('world');
    if (P && GEO_FILES[P]) await geo(P);
  } catch (_) { el.innerHTML = '<p class="info" style="padding:16px">Per disegnare la cartina la prima volta serve internet. L’elenco qui sotto funziona anche senza.</p>'; return; }
  if (!document.getElementById('map') || tab !== 'mappa') return;
  const { zones } = mapData();
  const W = 600; let H = 460;
  const fitH = (b) => { const k = Math.cos(((b[1] + b[3]) / 2) * Math.PI / 180); H = Math.round(Math.max(340, Math.min(720, W * (b[3] - b[1]) / ((b[2] - b[0]) * k || 1)))); return b; };
  let out = '';
  const dot = (i, P0, has, n) => { const r = REGIONS[i], [x, y] = P0([r.lo, r.la]); const sel = mPick && mPick.kind === 'z' && mPick.i === i; return `<g class="mdot${has ? ' has' : ''}${sel ? ' sel' : ''}" data-a="mzone" data-i="${i}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${has ? 7 + Math.min(8, n) : 3.5}"/>${has ? `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}">${n}</text>` : ''}</g>`; };
  const label = (t, [x, y], cls) => `<text class="mlab ${cls || ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(t)}</text>`;

  if (!P) {
    // MONDO: paesi con bottiglie in evidenza
    const by = new Map();
    zones.forEach((z) => by.set(z.r.p, (by.get(z.r.p) || 0) + z.bs.length));
    const max = Math.max(1, ...by.values());
    const hit = GEO.world.filter((c) => by.has(c.n));
    let b = bbox(hit.map((c) => c.r.filter((r) => r.length > 8)));
    const eu = [-10, 35, 25, 56];
    b = hit.length ? [Math.min(b[0], eu[0]), Math.min(b[1], eu[1]), Math.max(b[2], eu[2]), Math.max(b[3], eu[3])] : eu;
    const Pj = projector(b, W, H, 18);
    GEO.world.forEach((c) => { const n = by.get(c.n); out += `<path class="mland${n ? ' on' : ''}" ${n ? `data-a="mgo" data-p="${esc(c.n)}" style="${shade(n, max)}"` : ''} d="${pathOf(c.r, Pj)}"/>`; });
    hit.forEach((c) => {
      const big = c.r.slice().sort((a, b2) => b2.length - a.length)[0];
      const bb = bbox([[big]]), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
      const cz = REGIONS.find((r) => r.n === c.n && r.p === c.n);
      const [x, y] = Pj(cz && c.n !== 'Stati Uniti' ? [cz.lo, cz.la] : [cx, cy]);
      out += `<g class="mbadge" data-a="mgo" data-p="${esc(c.n)}"><rect x="${(x - 30).toFixed(1)}" y="${(y - 11).toFixed(1)}" width="60" height="22" rx="11"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${esc(c.n.length > 9 ? c.n.slice(0, 8) + '.' : c.n)} ${by.get(c.n)}</text></g>`;
    });
  } else if (!G && GEO[P] && GEO[P].regions) {
    // PAESE con suddivisioni (Italia per regioni, Francia per regioni vinicole)
    const by = new Map();
    zones.filter((z) => z.r.p === P && z.r.g).forEach((z) => by.set(z.r.g, (by.get(z.r.g) || 0) + z.bs.length));
    const max = Math.max(1, ...by.values());
    if (P === 'Francia') {
      const subs = GEO[P].subs, Pj = projector(fitH(bbox(subs.map((s) => s.r))), W, H, 14);
      subs.forEach((s) => { out += `<path class="mland soft" d="${pathOf(s.r, Pj)}"/>`; });
      Object.entries(FR_GROUPS).forEach(([g, deps]) => {
        const n = by.get(g); const rs = subs.filter((s) => deps.includes(s.n));
        out += `<path class="mland grp${n ? ' on' : ''}" data-a="mgo" data-g="${esc(g)}" style="${shade(n, max)}" d="${rs.map((s) => pathOf(s.r, Pj)).join('')}"/>`;
      });
      Object.entries(FR_GROUPS).forEach(([g, deps]) => {
        const rs = subs.filter((s) => deps.includes(s.n)); if (!rs.length) return;
        const gz = REGIONS.find((r) => r.p === P && r.n === g), bb = bbox(rs.map((s) => s.r));
        out += label(g + (by.get(g) ? ' · ' + by.get(g) : ''), Pj(gz ? [gz.lo, gz.la] : [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]), by.get(g) ? 'on' : '');
      });
    } else {
      const regs = GEO[P].regions, Pj = projector(fitH(bbox(regs.map((r) => r.r))), W, H, 14);
      regs.forEach((r) => { const n = by.get(r.n); out += `<path class="mland${n ? ' on' : ''}" data-a="mgo" data-g="${esc(r.n)}" style="${shade(n, max)}" d="${pathOf(r.r, Pj)}"/>`; });
      regs.forEach((r) => { const n = by.get(r.n); if (!n) return; const gz = REGIONS.find((x) => x.p === P && x.n === r.n); if (gz) out += `<g class="mbadge sm" data-a="mgo" data-g="${esc(r.n)}">${(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${n}</text>`)(Pj([gz.lo, gz.la]))}</g>`; });
    }
  } else if (G && GEO[P] && GEO[P].subs) {
    // REGIONE: province / dipartimenti e denominazioni
    const subs = P === 'Francia' ? GEO[P].subs.filter((s) => (FR_GROUPS[G] || []).includes(s.n)) : GEO[P].subs.filter((s) => s.g === G);
    const inG = zones.filter((z) => z.r.p === P && z.r.g === G);
    const cnt = new Map(); inG.forEach((z) => { const s = subOf(z.i); if (s) cnt.set(s, (cnt.get(s) || 0) + z.bs.length); });
    const max = Math.max(1, ...cnt.values());
    const b = bbox(subs.map((s) => s.r)), m = 0.25;
    const Pj = projector(fitH([b[0] - m, b[1] - m * 0.6, b[2] + m, b[3] + m * 0.6]), W, H, 10);
    const nb = P === 'Francia' ? GEO[P].subs : GEO[P].subs;
    nb.filter((s) => !subs.includes(s)).forEach((s) => { out += `<path class="mland ghost" d="${pathOf(s.r, Pj)}"/>`; });
    subs.forEach((s) => { const n = cnt.get(s.n), sel = mPick && mPick.kind === 's' && mPick.n === s.n; out += `<path class="mland${n ? ' on' : ' base'}${sel ? ' sel' : ''}" data-a="msub" data-n="${esc(s.n)}" style="${shade(n, max)}" d="${pathOf(s.r, Pj)}"/>`; });
    subs.forEach((s) => { const bb = bbox([s.r]); out += label(s.n, Pj([(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]), 'sub'); });
    REGIONS.forEach((r, i) => { if (r.p !== P || r.g !== G || regLevel(r) !== 2) return; const z = inG.find((x) => x.i === i); out += dot(i, Pj, !!z, z ? z.bs.length : 0); });
  } else {
    // PAESE senza suddivisioni: contorno del paese e zone come punti
    const c = GEO.world.find((x) => x.n === P);
    const inP = zones.filter((z) => z.r.p === P && regLevel(z.r) > 0);
    let b = c ? bbox([c.r.filter((r) => r.length > 6)]) : [-10, 35, 25, 56];
    if (P === 'Stati Uniti') b = [-125, 25, -66, 49];
    const Pj = projector(fitH(b), W, H, 24);
    GEO.world.forEach((x) => { out += `<path class="mland ${x.n === P ? 'base' : 'ghost'}" d="${pathOf(x.r, Pj)}"/>`; });
    REGIONS.forEach((r, i) => { if (r.p !== P || regLevel(r) === 0) return; const z = inP.find((x) => x.i === i); out += dot(i, Pj, !!z, z ? z.bs.length : 0); });
    inP.forEach((z) => { out += label(z.r.n, ((p) => [p[0], p[1] - 14 - Math.min(8, z.bs.length)])(Pj([z.r.lo, z.r.la])), 'on'); });
  }
  const pn = document.getElementById('mpanel'); if (pn) { const d = mapData(); pn.innerHTML = mapPanel(d.zones, d.un); }
  el.style.aspectRatio = W + '/' + H;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cartina: ${esc(mPath.join(' › ') || 'Mondo')}"><rect class="msea" width="${W}" height="${H}"/>${out}</svg>`;
}

function mapGo(next, pick) {
  mPath = next; mPick = pick || null;
  const { zones, un } = mapData();
  const c = document.querySelector('.mcrumb'); if (c) c.outerHTML = crumbs();
  const p = document.getElementById('mpanel'); if (p) p.innerHTML = mapPanel(zones, un);
  initMap();
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-a]');
  if (!t || tab !== 'mappa') return;
  const a = t.dataset.a;
  if (a === 'mup') mapGo(mPath.slice(0, +t.dataset.k));
  else if (a === 'mgo' && t.dataset.p) mapGo([t.dataset.p]);
  else if (a === 'mgo' && t.dataset.g) mapGo([mPath[0], t.dataset.g]);
  else if (a === 'msub') mapGo(mPath, mPick && mPick.kind === 's' && mPick.n === t.dataset.n ? null : { kind: 's', n: t.dataset.n });
  else if (a === 'mzone') {
    const i = +t.dataset.i, r = REGIONS[i];
    const path = [r.p].concat(r.g && GEO_FILES[r.p] ? [r.g] : []);
    if (r.g && GEO_FILES[r.p] && !GEO[r.p]) geo(r.p).then(() => mapGo(path, { kind: 'z', i }));
    else mapGo(path, mPick && mPick.kind === 'z' && mPick.i === i ? null : { kind: 'z', i });
    const p = document.getElementById('mpanel'); if (p && e.target.closest('#mpanel')) setTimeout(() => { const m = document.getElementById('map'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  }
});
function pickRegion(i) { const r = REGIONS[i]; mapGo([r.p].concat(r.g ? [r.g] : []), { kind: 'z', i }); }
