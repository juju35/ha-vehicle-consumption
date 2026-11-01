/**
 * vehicle-consumption-card — the fuel and energy consumption tracked by the Vehicle Consumption integration:
 * tank and battery gauges, last trip, this month, average, cost per km, a monthly chart, the recent trips and the
 * refuels / charges, with a popup to log a refuel or a charge by hand.
 * Served and added to the dashboard resources by the integration.
 * https://github.com/juju35/ha-vehicle-consumption
 */
var VEHICLE_CONSUMPTION_CARD_VERSION = '0.2.4';

const VC_I18N = {
  en: {
    title: 'Vehicle',
    not_loaded: 'Not set up',
    not_loaded_hint: 'Vehicle Consumption is not set up: add a vehicle in Settings → Devices & services',
    driving: 'Driving',
    fuel: 'Fuel',
    battery: 'Battery',
    trip: 'Last trip',
    trip_now: 'Current trip',
    month: 'This month',
    average: 'Average',
    cost_km: 'Cost per km',
    month_cost: '{v} this month',
    recent_trips: 'Recent trips',
    refuels: 'Refuels',
    charges: 'Charges',
    no_trips: 'No trip yet',
    no_refuels: 'No refuel yet',
    no_charges: 'No charge yet',
    manual: 'Logged by hand',
    charger: 'Home charger',
    chart_consumption: 'Consumption',
    chart_distance: 'Distance',
    chart_cost: 'Cost',
    last_months: 'Last {n} months',
    add: 'Log a refuel or a charge',
    add_refuel: 'Log a refuel',
    add_charge: 'Log a charge',
    mode_refuel: 'Fuel',
    mode_charge: 'Charge',
    liters: 'Fuel added',
    energy: 'Energy added',
    total_cost: 'Total cost',
    odometer: 'Odometer',
    optional: 'optional',
    save: 'Save',
    cancel: 'Cancel',
    save_error: 'Could not save: {e}',
    ed_entity: 'Vehicle',
    ed_entity_helper: 'Found automatically; leave empty to use the first vehicle',
    ed_title: 'Title',
    ed_title_helper: 'Leave empty for the vehicle name',
    ed_chart: 'Monthly chart',
    ed_chart_metric: 'Chart shows',
    ed_months: 'Months in the chart',
    ed_trips: 'Recent trips',
    ed_refuels: 'Refuels and charges',
    ed_add_button: '“Log a refuel or a charge” button',
    ed_language: 'Language',
    ed_language_helper: 'Leave empty to follow Home Assistant',
  },
  fr: {
    title: 'Véhicule',
    not_loaded: 'Non configuré',
    not_loaded_hint: 'Vehicle Consumption n’est pas configuré : ajouter un véhicule dans Paramètres → Appareils et services',
    driving: 'En route',
    fuel: 'Carburant',
    battery: 'Batterie',
    trip: 'Dernier trajet',
    trip_now: 'Trajet en cours',
    month: 'Ce mois-ci',
    average: 'Moyenne',
    cost_km: 'Coût au km',
    month_cost: '{v} ce mois-ci',
    recent_trips: 'Trajets récents',
    refuels: 'Pleins',
    charges: 'Recharges',
    no_trips: 'Aucun trajet pour l’instant',
    no_refuels: 'Aucun plein pour l’instant',
    no_charges: 'Aucune recharge pour l’instant',
    manual: 'Saisi à la main',
    charger: 'Borne à domicile',
    chart_consumption: 'Consommation',
    chart_distance: 'Distance',
    chart_cost: 'Coût',
    last_months: '{n} derniers mois',
    add: 'Noter un plein ou une recharge',
    add_refuel: 'Noter un plein',
    add_charge: 'Noter une recharge',
    mode_refuel: 'Carburant',
    mode_charge: 'Recharge',
    liters: 'Carburant ajouté',
    energy: 'Énergie ajoutée',
    total_cost: 'Coût total',
    odometer: 'Compteur',
    optional: 'facultatif',
    save: 'Enregistrer',
    cancel: 'Annuler',
    save_error: 'Enregistrement impossible : {e}',
    ed_entity: 'Véhicule',
    ed_entity_helper: 'Trouvé automatiquement ; laisser vide pour utiliser le premier véhicule',
    ed_title: 'Titre',
    ed_title_helper: 'Laisser vide pour le nom du véhicule',
    ed_chart: 'Graphique mensuel',
    ed_chart_metric: 'Le graphique montre',
    ed_months: 'Mois dans le graphique',
    ed_trips: 'Trajets récents',
    ed_refuels: 'Pleins et recharges',
    ed_add_button: 'Bouton « Noter un plein ou une recharge »',
    ed_language: 'Langue',
    ed_language_helper: 'Laisser vide pour suivre Home Assistant',
  },
  de: {
    title: 'Fahrzeug',
    not_loaded: 'Nicht eingerichtet',
    not_loaded_hint: 'Vehicle Consumption ist nicht eingerichtet: Fahrzeug unter Einstellungen → Geräte & Dienste hinzufügen',
    driving: 'Unterwegs',
    fuel: 'Kraftstoff',
    battery: 'Batterie',
    trip: 'Letzte Fahrt',
    trip_now: 'Aktuelle Fahrt',
    month: 'Diesen Monat',
    average: 'Durchschnitt',
    cost_km: 'Kosten pro km',
    month_cost: '{v} diesen Monat',
    recent_trips: 'Letzte Fahrten',
    refuels: 'Tankvorgänge',
    charges: 'Ladevorgänge',
    no_trips: 'Noch keine Fahrt',
    no_refuels: 'Noch kein Tankvorgang',
    no_charges: 'Noch kein Ladevorgang',
    manual: 'Von Hand erfasst',
    charger: 'Wallbox zu Hause',
    chart_consumption: 'Verbrauch',
    chart_distance: 'Strecke',
    chart_cost: 'Kosten',
    last_months: 'Letzte {n} Monate',
    add: 'Tank- oder Ladevorgang erfassen',
    add_refuel: 'Tankvorgang erfassen',
    add_charge: 'Ladevorgang erfassen',
    mode_refuel: 'Tanken',
    mode_charge: 'Laden',
    liters: 'Getankte Menge',
    energy: 'Geladene Energie',
    total_cost: 'Gesamtkosten',
    odometer: 'Kilometerstand',
    optional: 'optional',
    save: 'Speichern',
    cancel: 'Abbrechen',
    save_error: 'Speichern nicht möglich: {e}',
    ed_entity: 'Fahrzeug',
    ed_entity_helper: 'Automatisch gefunden; leer lassen, um das erste Fahrzeug zu verwenden',
    ed_title: 'Titel',
    ed_title_helper: 'Leer lassen für den Fahrzeugnamen',
    ed_chart: 'Monatsdiagramm',
    ed_chart_metric: 'Diagramm zeigt',
    ed_months: 'Monate im Diagramm',
    ed_trips: 'Letzte Fahrten',
    ed_refuels: 'Tank- und Ladevorgänge',
    ed_add_button: 'Schaltfläche „Tank- oder Ladevorgang erfassen“',
    ed_language: 'Sprache',
    ed_language_helper: 'Leer lassen, um Home Assistant zu folgen',
  },
  es: {
    title: 'Vehículo',
    not_loaded: 'No configurado',
    not_loaded_hint: 'Vehicle Consumption no está configurado: añade un vehículo en Ajustes → Dispositivos y servicios',
    driving: 'En marcha',
    fuel: 'Combustible',
    battery: 'Batería',
    trip: 'Último trayecto',
    trip_now: 'Trayecto en curso',
    month: 'Este mes',
    average: 'Media',
    cost_km: 'Coste por km',
    month_cost: '{v} este mes',
    recent_trips: 'Trayectos recientes',
    refuels: 'Repostajes',
    charges: 'Cargas',
    no_trips: 'Aún no hay trayectos',
    no_refuels: 'Aún no hay repostajes',
    no_charges: 'Aún no hay cargas',
    manual: 'Registrado a mano',
    charger: 'Cargador doméstico',
    chart_consumption: 'Consumo',
    chart_distance: 'Distancia',
    chart_cost: 'Coste',
    last_months: 'Últimos {n} meses',
    add: 'Registrar un repostaje o una carga',
    add_refuel: 'Registrar un repostaje',
    add_charge: 'Registrar una carga',
    mode_refuel: 'Combustible',
    mode_charge: 'Carga',
    liters: 'Combustible añadido',
    energy: 'Energía añadida',
    total_cost: 'Coste total',
    odometer: 'Cuentakilómetros',
    optional: 'opcional',
    save: 'Guardar',
    cancel: 'Cancelar',
    save_error: 'No se pudo guardar: {e}',
    ed_entity: 'Vehículo',
    ed_entity_helper: 'Encontrado automáticamente; déjalo vacío para usar el primer vehículo',
    ed_title: 'Título',
    ed_title_helper: 'Déjalo vacío para el nombre del vehículo',
    ed_chart: 'Gráfico mensual',
    ed_chart_metric: 'El gráfico muestra',
    ed_months: 'Meses en el gráfico',
    ed_trips: 'Trayectos recientes',
    ed_refuels: 'Repostajes y cargas',
    ed_add_button: 'Botón «Registrar un repostaje o una carga»',
    ed_language: 'Idioma',
    ed_language_helper: 'Déjalo vacío para seguir a Home Assistant',
  },
  it: {
    title: 'Veicolo',
    not_loaded: 'Non configurato',
    not_loaded_hint: 'Vehicle Consumption non è configurato: aggiungi un veicolo in Impostazioni → Dispositivi e servizi',
    driving: 'In marcia',
    fuel: 'Carburante',
    battery: 'Batteria',
    trip: 'Ultimo viaggio',
    trip_now: 'Viaggio in corso',
    month: 'Questo mese',
    average: 'Media',
    cost_km: 'Costo al km',
    month_cost: '{v} questo mese',
    recent_trips: 'Viaggi recenti',
    refuels: 'Rifornimenti',
    charges: 'Ricariche',
    no_trips: 'Ancora nessun viaggio',
    no_refuels: 'Ancora nessun rifornimento',
    no_charges: 'Ancora nessuna ricarica',
    manual: 'Inserito a mano',
    charger: 'Wallbox di casa',
    chart_consumption: 'Consumo',
    chart_distance: 'Distanza',
    chart_cost: 'Costo',
    last_months: 'Ultimi {n} mesi',
    add: 'Registra un rifornimento o una ricarica',
    add_refuel: 'Registra un rifornimento',
    add_charge: 'Registra una ricarica',
    mode_refuel: 'Carburante',
    mode_charge: 'Ricarica',
    liters: 'Carburante aggiunto',
    energy: 'Energia aggiunta',
    total_cost: 'Costo totale',
    odometer: 'Contachilometri',
    optional: 'facoltativo',
    save: 'Salva',
    cancel: 'Annulla',
    save_error: 'Impossibile salvare: {e}',
    ed_entity: 'Veicolo',
    ed_entity_helper: 'Trovato automaticamente; lascia vuoto per usare il primo veicolo',
    ed_title: 'Titolo',
    ed_title_helper: 'Lascia vuoto per il nome del veicolo',
    ed_chart: 'Grafico mensile',
    ed_chart_metric: 'Il grafico mostra',
    ed_months: 'Mesi nel grafico',
    ed_trips: 'Viaggi recenti',
    ed_refuels: 'Rifornimenti e ricariche',
    ed_add_button: 'Pulsante «Registra un rifornimento o una ricarica»',
    ed_language: 'Lingua',
    ed_language_helper: 'Lascia vuoto per seguire Home Assistant',
  },
  nl: {
    title: 'Voertuig',
    not_loaded: 'Niet ingesteld',
    not_loaded_hint: 'Vehicle Consumption is niet ingesteld: voeg een voertuig toe via Instellingen → Apparaten & diensten',
    driving: 'Onderweg',
    fuel: 'Brandstof',
    battery: 'Accu',
    trip: 'Laatste rit',
    trip_now: 'Huidige rit',
    month: 'Deze maand',
    average: 'Gemiddeld',
    cost_km: 'Kosten per km',
    month_cost: '{v} deze maand',
    recent_trips: 'Recente ritten',
    refuels: 'Tankbeurten',
    charges: 'Laadbeurten',
    no_trips: 'Nog geen rit',
    no_refuels: 'Nog geen tankbeurt',
    no_charges: 'Nog geen laadbeurt',
    manual: 'Handmatig ingevoerd',
    charger: 'Laadpaal thuis',
    chart_consumption: 'Verbruik',
    chart_distance: 'Afstand',
    chart_cost: 'Kosten',
    last_months: 'Laatste {n} maanden',
    add: 'Tankbeurt of laadbeurt invoeren',
    add_refuel: 'Tankbeurt invoeren',
    add_charge: 'Laadbeurt invoeren',
    mode_refuel: 'Brandstof',
    mode_charge: 'Laden',
    liters: 'Getankte brandstof',
    energy: 'Geladen energie',
    total_cost: 'Totale kosten',
    odometer: 'Kilometerstand',
    optional: 'optioneel',
    save: 'Opslaan',
    cancel: 'Annuleren',
    save_error: 'Opslaan mislukt: {e}',
    ed_entity: 'Voertuig',
    ed_entity_helper: 'Automatisch gevonden; laat leeg om het eerste voertuig te gebruiken',
    ed_title: 'Titel',
    ed_title_helper: 'Laat leeg voor de naam van het voertuig',
    ed_chart: 'Maandgrafiek',
    ed_chart_metric: 'Grafiek toont',
    ed_months: 'Maanden in de grafiek',
    ed_trips: 'Recente ritten',
    ed_refuels: 'Tank- en laadbeurten',
    ed_add_button: 'Knop „Tankbeurt of laadbeurt invoeren”',
    ed_language: 'Taal',
    ed_language_helper: 'Laat leeg om Home Assistant te volgen',
  },
  pt: {
    title: 'Veículo',
    not_loaded: 'Não configurado',
    not_loaded_hint: 'O Vehicle Consumption não está configurado: adicione um veículo em Definições → Dispositivos e serviços',
    driving: 'Em viagem',
    fuel: 'Combustível',
    battery: 'Bateria',
    trip: 'Última viagem',
    trip_now: 'Viagem em curso',
    month: 'Este mês',
    average: 'Média',
    cost_km: 'Custo por km',
    month_cost: '{v} este mês',
    recent_trips: 'Viagens recentes',
    refuels: 'Abastecimentos',
    charges: 'Carregamentos',
    no_trips: 'Ainda sem viagens',
    no_refuels: 'Ainda sem abastecimentos',
    no_charges: 'Ainda sem carregamentos',
    manual: 'Registado manualmente',
    charger: 'Carregador doméstico',
    chart_consumption: 'Consumo',
    chart_distance: 'Distância',
    chart_cost: 'Custo',
    last_months: 'Últimos {n} meses',
    add: 'Registar um abastecimento ou carregamento',
    add_refuel: 'Registar um abastecimento',
    add_charge: 'Registar um carregamento',
    mode_refuel: 'Combustível',
    mode_charge: 'Carregamento',
    liters: 'Combustível abastecido',
    energy: 'Energia carregada',
    total_cost: 'Custo total',
    odometer: 'Conta-quilómetros',
    optional: 'opcional',
    save: 'Guardar',
    cancel: 'Cancelar',
    save_error: 'Não foi possível guardar: {e}',
    ed_entity: 'Veículo',
    ed_entity_helper: 'Encontrado automaticamente; deixe vazio para usar o primeiro veículo',
    ed_title: 'Título',
    ed_title_helper: 'Deixe vazio para o nome do veículo',
    ed_chart: 'Gráfico mensal',
    ed_chart_metric: 'O gráfico mostra',
    ed_months: 'Meses no gráfico',
    ed_trips: 'Viagens recentes',
    ed_refuels: 'Abastecimentos e carregamentos',
    ed_add_button: 'Botão «Registar um abastecimento ou carregamento»',
    ed_language: 'Idioma',
    ed_language_helper: 'Deixe vazio para seguir o Home Assistant',
  },
  pl: {
    title: 'Pojazd',
    not_loaded: 'Nieskonfigurowane',
    not_loaded_hint: 'Vehicle Consumption nie jest skonfigurowane: dodaj pojazd w Ustawienia → Urządzenia oraz usługi',
    driving: 'W trasie',
    fuel: 'Paliwo',
    battery: 'Akumulator',
    trip: 'Ostatnia trasa',
    trip_now: 'Bieżąca trasa',
    month: 'Ten miesiąc',
    average: 'Średnio',
    cost_km: 'Koszt za km',
    month_cost: '{v} w tym mies.',
    recent_trips: 'Ostatnie trasy',
    refuels: 'Tankowania',
    charges: 'Ładowania',
    no_trips: 'Brak tras',
    no_refuels: 'Brak tankowań',
    no_charges: 'Brak ładowań',
    manual: 'Wprowadzone ręcznie',
    charger: 'Ładowarka domowa',
    chart_consumption: 'Zużycie',
    chart_distance: 'Dystans',
    chart_cost: 'Koszt',
    last_months: 'Ostatnie miesiące: {n}',
    add: 'Zapisz tankowanie lub ładowanie',
    add_refuel: 'Zapisz tankowanie',
    add_charge: 'Zapisz ładowanie',
    mode_refuel: 'Paliwo',
    mode_charge: 'Ładowanie',
    liters: 'Zatankowane paliwo',
    energy: 'Doładowana energia',
    total_cost: 'Koszt całkowity',
    odometer: 'Licznik przebiegu',
    optional: 'opcjonalnie',
    save: 'Zapisz',
    cancel: 'Anuluj',
    save_error: 'Nie udało się zapisać: {e}',
    ed_entity: 'Pojazd',
    ed_entity_helper: 'Wyszukiwany automatycznie; pozostaw puste, aby użyć pierwszego pojazdu',
    ed_title: 'Tytuł',
    ed_title_helper: 'Pozostaw puste, aby użyć nazwy pojazdu',
    ed_chart: 'Wykres miesięczny',
    ed_chart_metric: 'Wykres pokazuje',
    ed_months: 'Miesiące na wykresie',
    ed_trips: 'Ostatnie trasy',
    ed_refuels: 'Tankowania i ładowania',
    ed_add_button: 'Przycisk „Zapisz tankowanie lub ładowanie”',
    ed_language: 'Język',
    ed_language_helper: 'Pozostaw puste, aby używać języka Home Assistant',
  },
  sr: {
    title: 'Возило',
    not_loaded: 'Није подешено',
    not_loaded_hint: 'Vehicle Consumption није подешен: додајте возило у Подешавања → Уређаји и услуге',
    driving: 'У вожњи',
    fuel: 'Гориво',
    battery: 'Батерија',
    trip: 'Последња вожња',
    trip_now: 'Тренутна вожња',
    month: 'Овај месец',
    average: 'Просек',
    cost_km: 'Трошак по km',
    month_cost: '{v} овог месеца',
    recent_trips: 'Недавне вожње',
    refuels: 'Точења горива',
    charges: 'Пуњења',
    no_trips: 'Још нема вожњи',
    no_refuels: 'Још нема точења горива',
    no_charges: 'Још нема пуњења',
    manual: 'Унето ручно',
    charger: 'Кућни пуњач',
    chart_consumption: 'Потрошња',
    chart_distance: 'Пређени пут',
    chart_cost: 'Трошак',
    last_months: 'Последњи месеци: {n}',
    add: 'Унеси точење горива или пуњење',
    add_refuel: 'Унеси точење горива',
    add_charge: 'Унеси пуњење',
    mode_refuel: 'Гориво',
    mode_charge: 'Пуњење',
    liters: 'Сипано гориво',
    energy: 'Додата енергија',
    total_cost: 'Укупан трошак',
    odometer: 'Километража',
    optional: 'опционо',
    save: 'Сачувај',
    cancel: 'Откажи',
    save_error: 'Чување није успело: {e}',
    ed_entity: 'Возило',
    ed_entity_helper: 'Проналази се аутоматски; оставите празно да би се користило прво возило',
    ed_title: 'Наслов',
    ed_title_helper: 'Оставите празно за назив возила',
    ed_chart: 'Месечни графикон',
    ed_chart_metric: 'Графикон приказује',
    ed_months: 'Месеци у графикону',
    ed_trips: 'Недавне вожње',
    ed_refuels: 'Точења горива и пуњења',
    ed_add_button: 'Дугме „Унеси точење горива или пуњење“',
    ed_language: 'Језик',
    ed_language_helper: 'Оставите празно да би се пратио Home Assistant',
  },
  'sr-Latn': {
    title: 'Vozilo',
    not_loaded: 'Nije podešeno',
    not_loaded_hint: 'Vehicle Consumption nije podešen: dodajte vozilo u Podešavanja → Uređaji i usluge',
    driving: 'U vožnji',
    fuel: 'Gorivo',
    battery: 'Baterija',
    trip: 'Poslednja vožnja',
    trip_now: 'Trenutna vožnja',
    month: 'Ovaj mesec',
    average: 'Prosek',
    cost_km: 'Trošak po km',
    month_cost: '{v} ovog meseca',
    recent_trips: 'Nedavne vožnje',
    refuels: 'Točenja goriva',
    charges: 'Punjenja',
    no_trips: 'Još nema vožnji',
    no_refuels: 'Još nema točenja goriva',
    no_charges: 'Još nema punjenja',
    manual: 'Uneto ručno',
    charger: 'Kućni punjač',
    chart_consumption: 'Potrošnja',
    chart_distance: 'Pređeni put',
    chart_cost: 'Trošak',
    last_months: 'Poslednji meseci: {n}',
    add: 'Unesi točenje goriva ili punjenje',
    add_refuel: 'Unesi točenje goriva',
    add_charge: 'Unesi punjenje',
    mode_refuel: 'Gorivo',
    mode_charge: 'Punjenje',
    liters: 'Sipano gorivo',
    energy: 'Dodata energija',
    total_cost: 'Ukupan trošak',
    odometer: 'Kilometraža',
    optional: 'opciono',
    save: 'Sačuvaj',
    cancel: 'Otkaži',
    save_error: 'Čuvanje nije uspelo: {e}',
    ed_entity: 'Vozilo',
    ed_entity_helper: 'Pronalazi se automatski; ostavite prazno da bi se koristilo prvo vozilo',
    ed_title: 'Naslov',
    ed_title_helper: 'Ostavite prazno za naziv vozila',
    ed_chart: 'Mesečni grafikon',
    ed_chart_metric: 'Grafikon prikazuje',
    ed_months: 'Meseci u grafikonu',
    ed_trips: 'Nedavne vožnje',
    ed_refuels: 'Točenja goriva i punjenja',
    ed_add_button: 'Dugme „Unesi točenje goriva ili punjenje“',
    ed_language: 'Jezik',
    ed_language_helper: 'Ostavite prazno da bi se pratio Home Assistant',
  },
};

const vcLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  // Exact code first (sr-Latn, Serbian in Latin script), then its base language (fr-FR → fr), then English.
  if (VC_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return VC_I18N[l] ? l : 'en';
};

const vcT = (lang, key, vars = {}) =>
  (VC_I18N[lang]?.[key] ?? VC_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

const vcEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const VC_DEFAULTS = {
  chart: true,
  chart_metric: 'consumption',
  months: 6,
  trips: true,
  refuels: true,
  add_button: true,
};
const VC_METRICS = ['consumption', 'distance', 'cost'];
// Rows listed in a folded section, newest first.
const VC_ROWS = 5;
// A gauge under this level turns to the warning colour.
const VC_LOW = 15;
// First-render animations (gauge fill, chart bars) last this long: a re-render inside that window resumes them.
const VC_ANIM_MS = 1600;
const VC_DASH = '—';

const vcFinite = (v) => v != null && v !== '' && Number.isFinite(Number(v));

// Home Assistant's `pt` is European Portuguese, while Intl reads a bare `pt` as Brazilian (« € 1.234 », « 30 de out. »).
const vcIntlLocale = (l) => (String(l || '').toLowerCase() === 'pt' ? 'pt-PT' : l);

// Number, money and date formatting: numbers follow Home Assistant's number format (its locale by default),
// month and day names follow the card language.
function vcFormat(hass, lang, currency) {
  const loc = hass?.locale || {};
  const byFormat = { comma_decimal: 'en-US', decimal_comma: 'de-DE', space_comma: 'fr-FR', system: undefined };
  const locale = vcIntlLocale(loc.number_format in byFormat ? byFormat[loc.number_format] : loc.language || hass?.language || lang);
  const grouping = loc.number_format !== 'none';
  const cache = new Map();
  const nf = (opts) => {
    const key = JSON.stringify(opts);
    if (!cache.has(key)) {
      let f;
      try {
        f = new Intl.NumberFormat(locale, { useGrouping: grouping, ...opts });
      } catch {
        f = new Intl.NumberFormat('en', { useGrouping: grouping, ...opts });
      }
      cache.set(key, f);
    }
    return cache.get(key);
  };
  const cur = /^[A-Z]{3}$/.test(String(currency || '')) ? currency : null;
  const num = (v, digits = 1) =>
    vcFinite(v) ? nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v)) : VC_DASH;
  const money = (v, digits = 2) => {
    if (!vcFinite(v)) return VC_DASH;
    if (!cur) return num(v, digits);
    return nf({ style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v));
  };
  const symbol = () => (cur ? nf({ style: 'currency', currency: cur }).formatToParts(0).find((p) => p.type === 'currency')?.value || cur : '');
  // Home Assistant's full locale (pt-BR, de-CH) when it resolves to the card language, the card language otherwise
  // (a card set to sr keeps Cyrillic month names under a Home Assistant in sr-Latn).
  const haLang = String(loc.language || hass?.language || '');
  let dateLocale = vcIntlLocale(haLang && vcLang({ language: haLang }, {}) === lang ? haLang : lang);
  try {
    Intl.DateTimeFormat.supportedLocalesOf(dateLocale);
  } catch {
    dateLocale = vcIntlLocale(lang);
  }
  const dateFmt = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' });
  const timeFmt = new Intl.DateTimeFormat(dateLocale, { hour: '2-digit', minute: '2-digit' });
  const monthFmt = new Intl.DateTimeFormat(dateLocale, { month: 'short', timeZone: 'UTC' });
  const date = (iso, withTime = true) => {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return VC_DASH;
    return withTime ? `${dateFmt.format(d)}, ${timeFmt.format(d)}` : dateFmt.format(d);
  };
  // "2026-10" → "Oct" (short month name, without the trailing dot some languages add).
  const month = (key) => {
    const [y, m] = String(key).split('-').map(Number);
    return y && m ? monthFmt.format(new Date(Date.UTC(y, m - 1, 15))).replace(/\.$/, '') : '';
  };
  return { num, money, symbol, date, month };
}

// The `n` month keys ending with `last` ("YYYY-MM"), oldest first.
function vcMonthKeys(last, n) {
  let [y, m] = String(last).split('-').map(Number);
  if (!y || !m) {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth() + 1;
  }
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = y * 12 + (m - 1) - i;
    keys.push(`${Math.floor(d / 12)}-${String((d % 12) + 1).padStart(2, '0')}`);
  }
  return keys;
}

// The integration's sensors, from the entity registry, scanned once per registry object (an empty scan is not kept:
// the registry may not be loaded yet).
const vcScans = new WeakMap();
const vcCandidates = (registry) => {
  if (!registry) return [];
  const kept = vcScans.get(registry);
  if (kept) return kept;
  const found = Object.keys(registry).filter((id) => id.startsWith('sensor.') && registry[id]?.platform === 'vehicle_consumption');
  if (found.length) vcScans.set(registry, found);
  return found;
};

// The vehicle's display name: its `vehicle` attribute, else the sensor's friendly name, else the entity id.
const vcVehicleName = (st, id) => String(st?.attributes?.vehicle || st?.attributes?.friendly_name || id);

// Every vehicle: the main "Consumption" sensor of each config entry, the one whose state carries the monthly history,
// as [{ entity, name }] sorted by name (stable whatever the registry order).
const vcVehicles = (hass) =>
  vcCandidates(hass?.entities)
    .filter((id) => Array.isArray(hass?.states?.[id]?.attributes?.months))
    .map((id) => ({ entity: id, name: vcVehicleName(hass.states[id], id) }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.entity.localeCompare(b.entity));

// The first vehicle's sensor, or undefined.
const vcPick = (hass) => vcVehicles(hass)[0]?.entity;

// Which energies the vehicle tracks.
const vcTracks = (kind) => ({ fuel: kind !== 'electric', energy: kind === 'electric' || kind === 'plugin_hybrid' });

// A decimal typed with a comma or a dot, or null.
const vcParse = (s) => {
  const v = Number(String(s ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return String(s ?? '').trim() !== '' && Number.isFinite(v) ? v : null;
};

// The badge: the gauge of the projects site, coloured by the card's level.
const VC_ICON = 'mdi:gauge-low';
const VC_KINDS = ['fuel', 'electric', 'plugin_hybrid'];

class VehicleConsumptionCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('vehicle-consumption-card-editor');
  }

  // The card picker's preview shows a real vehicle when there is one.
  static getStubConfig(hass) {
    const entity = vcPick(hass);
    return entity ? { entity } : {};
  }

  constructor() {
    super();
    this._open = new Set();
    this._onDocClick = (ev) => this._foldOutside(ev);
    this._onKey = (ev) => {
      if (ev.key === 'Escape' && this._popup) this._closePopup();
    };
  }

  setConfig(config) {
    this._config = { ...VC_DEFAULTS, ...config };
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._sig = null;
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    // Nothing the card shows can have changed: same sensor state object, same registry, same language and locale.
    const entity = this._entity;
    if (
      old &&
      this._sig &&
      entity &&
      hass.states[entity] === old.states[entity] &&
      hass.entities === old.entities &&
      hass.locale === old.locale &&
      vcLang(hass, this._config) === vcLang(old, this._config)
    ) {
      return;
    }
    this._render();
  }

  connectedCallback() {
    document.addEventListener('click', this._onDocClick);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onKey);
  }

  getCardSize() {
    const c = this._config || {};
    return 4 + (c.chart !== false ? 3 : 0) + (c.trips !== false ? 1 : 0) + (c.refuels !== false ? 1 : 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  _t(key, vars) {
    return vcT(vcLang(this._hass, this._config), key, vars);
  }

  // The main sensor: the configured one, else the first vehicle found (by name). The registry scan is kept until
  // hass.entities changes; the states are read again each time.
  _lookup() {
    return this._config.entity || vcPick(this._hass);
  }

  _render(force = false) {
    if (!this._config || !this._hass || !this.shadowRoot) return;
    const c = this._config;
    const entity = this._lookup();
    const st = entity ? this._hass.states[entity] : undefined;
    const a = Array.isArray(st?.attributes?.months) ? st.attributes : null;
    const lang = vcLang(this._hass, c);
    const sig = JSON.stringify([c, lang, this._hass.locale, entity, st?.state, a, [...this._open], this._popup?.mode, !!this._popup]);
    this._entity = entity;
    if (!force && sig === this._sig) return;
    // The popup is being filled in: the update waits until it closes, so typing is never interrupted.
    if (this._popup && !force) {
      this._stale = true;
      return;
    }
    this._sig = sig;
    this._stale = false;
    this._attrs = a;

    if (!a) {
      this.shadowRoot.innerHTML = `
      <style>${VehicleConsumptionCard.styles}</style>
      <ha-card class="lvl-na">
        <div class="head">
          <div class="badge"><ha-icon icon="${VC_ICON}"></ha-icon></div>
          <div class="title">${vcEsc(c.title || this._t('title'))}</div>
          <div class="pill">${vcEsc(this._t('not_loaded'))}</div>
        </div>
        <div class="empty">${vcEsc(this._t('not_loaded_hint'))}</div>
      </ha-card>`;
      return;
    }

    const f = vcFormat(this._hass, lang, a.currency);
    const kind = VC_KINDS.includes(a.kind) ? a.kind : 'fuel';
    const tracks = vcTracks(kind);
    const gauges = [
      tracks.fuel ? this._gauge('fuel', a.fuel_level, a.fuel_quantity, 'L', 'mdi:gas-station', f) : null,
      tracks.energy ? this._gauge('battery', a.battery_level, a.battery_energy, 'kWh', 'mdi:battery-charging-medium', f) : null,
    ].filter(Boolean);
    const low = gauges.some((g) => g.low);
    const level = a.driving ? 'drive' : low ? 'warn' : 'ok';
    const unit = st.attributes.unit_of_measurement || (tracks.fuel ? 'L/100 km' : 'kWh/100 km');
    const avg = vcFinite(st.state) ? `${f.num(st.state, 1)} ${unit}` : VC_DASH;

    // First-render animations: started at the first render, resumed (negative delay) by a re-render inside the window.
    this._born ??= Date.now();
    const elapsed = Date.now() - this._born;
    const anim = elapsed < VC_ANIM_MS ? ` anim" style="--vc-t:${-elapsed}ms` : '';

    const add =
      c.add_button !== false && a.entry_id
        ? `<button class="icon-btn add" title="${vcEsc(this._t('add'))}" aria-label="${vcEsc(this._t('add'))}"><ha-icon icon="mdi:plus"></ha-icon></button>`
        : '';
    const driving = a.driving
      ? `<span class="drive" title="${vcEsc(this._t('driving'))}" aria-label="${vcEsc(this._t('driving'))}"></span>`
      : '';

    this.shadowRoot.innerHTML = `
      <style>${VehicleConsumptionCard.styles}</style>
      <ha-card class="lvl-${level}${this._popup ? ' has-popup' : ''}${anim}">
        <div class="head">
          <div class="badge"><ha-icon icon="${VC_ICON}"></ha-icon></div>
          <div class="title"><span class="tname">${vcEsc(c.title || a.vehicle || this._t('title'))}</span>${driving}</div>
          ${add}
          <div class="pill">${vcEsc(avg)}</div>
        </div>
        <div class="gauges">${gauges.map((g) => g.html).join('')}</div>
        <div class="kpis">${this._kpis(a, kind, f)}</div>
        ${c.chart !== false ? this._chart(a, kind, f) : ''}
        ${this._sections(a, kind, f)}
        ${this._popup ? this._popupHtml(a, kind, f) : ''}
      </ha-card>`;

    this._bind();
  }

  _bind() {
    const root = this.shadowRoot;
    root.querySelector('.add')?.addEventListener('click', () => this._openPopup());
    for (const el of root.querySelectorAll('.fold')) el.addEventListener('click', () => this._toggle(el.dataset.key));
    if (!this._popup) return;
    for (const el of root.querySelectorAll('[data-act]')) {
      el.addEventListener('click', () => (el.dataset.act === 'save' ? this._save() : this._closePopup()));
    }
    for (const el of root.querySelectorAll('[data-mode]')) el.addEventListener('click', () => this._setMode(el.dataset.mode));
    for (const el of root.querySelectorAll('input')) {
      el.addEventListener('input', () => this._input(el.name, el.value));
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') this._save();
      });
    }
    root.querySelector('input[name="amount"]')?.focus?.();
  }

  // A tank or battery gauge: { html, low }.
  _gauge(key, levelValue, amount, unit, icon, f) {
    const hasLevel = vcFinite(levelValue);
    const pct = hasLevel ? Math.max(0, Math.min(100, Number(levelValue))) : null;
    const low = hasLevel && pct < VC_LOW;
    const parts = [hasLevel ? `${f.num(pct, 0)} %` : '', vcFinite(amount) ? `${f.num(amount, 1)} ${unit}` : ''].filter(Boolean);
    const html = `
          <div class="gauge g-${key}${low ? ' low' : ''}">
            <span class="ic"><ha-icon icon="${icon}"></ha-icon></span>
            <span class="glabel">${vcEsc(this._t(key))}</span>
            <span class="gval">${vcEsc(parts.join(' · ') || VC_DASH)}</span>
            <span class="track"><span class="fill" style="width:${pct ?? 0}%"></span></span>
          </div>`;
    return { html, low };
  }

  // One consumption per tracked energy: [{ v, unit }].
  _cons(obj, kind, f) {
    const t = vcTracks(kind);
    return [
      t.fuel ? { v: f.num(obj?.fuel_consumption, 1), unit: 'L/100 km' } : null,
      t.energy ? { v: f.num(obj?.energy_consumption, 1), unit: 'kWh/100 km' } : null,
    ].filter(Boolean);
  }

  _kpi(cls, label, icon, lines, sub) {
    const values = lines
      .map((l) => `<span class="kv">${vcEsc(l.v)}${l.v === VC_DASH || !l.unit ? '' : `<small>${vcEsc(l.unit)}</small>`}</span>`)
      .join('');
    return `
          <div class="kpi ${cls}">
            <span class="kl"><ha-icon icon="${icon}"></ha-icon>${vcEsc(label)}</span>
            ${values}
            <span class="ks">${vcEsc(sub || VC_DASH)}</span>
          </div>`;
  }

  _kpis(a, kind, f) {
    const km = (v) => (vcFinite(v) ? `${f.num(v, Number(v) < 100 ? 1 : 0)} km` : '');
    const trip = a.trip || {};
    const tripSub = [km(trip.distance), vcFinite(trip.cost) ? f.money(trip.cost) : ''].filter(Boolean).join(' · ');
    const month = a.month || {};
    const total = a.total || {};
    const cpk = vcFinite(total.cost_per_km) ? total.cost_per_km : month.cost_per_km;
    return [
      this._kpi('k-trip', this._t(a.driving ? 'trip_now' : 'trip'), 'mdi:map-marker-distance', this._cons(trip, kind, f), tripSub),
      this._kpi('k-month', this._t('month'), 'mdi:calendar-month-outline', this._cons(month, kind, f), km(month.distance)),
      this._kpi('k-avg', this._t('average'), 'mdi:chart-line', this._cons(total, kind, f), km(total.distance)),
      this._kpi(
        'k-cost',
        this._t('cost_km'),
        'mdi:cash',
        [{ v: f.money(cpk, 3), unit: vcFinite(cpk) ? '/km' : '' }],
        vcFinite(month.cost) ? this._t('month_cost', { v: f.money(month.cost) }) : '',
      ),
    ].join('');
  }

  // The monthly bar chart, inline SVG: the last `months` months, the current one in the accent colour, the months
  // without data as faint stubs.
  _chart(a, kind, f) {
    const c = this._config;
    const n = Math.max(3, Math.min(12, Math.round(Number(c.months)) || VC_DEFAULTS.months));
    const metric = VC_METRICS.includes(c.chart_metric) ? c.chart_metric : 'consumption';
    const primary = kind === 'electric' ? 'energy' : 'fuel';
    const months = Array.isArray(a.months) ? a.months : [];
    const last = a.month?.month || months[months.length - 1]?.month;
    const keys = vcMonthKeys(last, n);
    const byKey = new Map(months.map((m) => [m?.month, m]));
    const metricOf = (m) => (metric === 'distance' ? m?.distance : metric === 'cost' ? m?.cost : m?.[`${primary}_consumption`]);
    const values = keys.map((k) => (vcFinite(metricOf(byKey.get(k))) ? Number(metricOf(byKey.get(k))) : null));
    const max = Math.max(0, ...values.filter((v) => v != null));
    const unit = metric === 'distance' ? 'km' : metric === 'cost' ? a.currency || '' : primary === 'fuel' ? 'L/100 km' : 'kWh/100 km';
    const label = (v) =>
      metric === 'cost' ? f.money(v, 0) : metric === 'distance' ? f.num(v, 0) : f.num(v, 1);
    const W = 400;
    const top = 16;
    const plot = 78;
    const base = top + plot;
    const H = base + 18;
    const slot = W / n;
    const bw = Math.min(30, slot * 0.58);
    const bars = keys
      .map((k, i) => {
        const v = values[i];
        const x = i * slot + (slot - bw) / 2;
        const cx = (i * slot + slot / 2).toFixed(1);
        const now = i === n - 1;
        const name = f.month(k);
        if (v == null || v <= 0 || max <= 0) {
          return `<g class="col"><rect class="bar stub" x="${x.toFixed(1)}" y="${base - 3}" width="${bw.toFixed(1)}" height="3" rx="1.5"><title>${vcEsc(`${name}: ${VC_DASH}`)}</title></rect>
            <text class="ml${now ? ' now' : ''}" x="${cx}" y="${H - 4}">${vcEsc(name)}</text></g>`;
        }
        const h = Math.max(4, (v / max) * plot);
        return `<g class="col"><rect class="bar${now ? ' now' : ''}" style="--i:${i}" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4"><title>${vcEsc(`${name}: ${label(v)} ${metric === 'cost' ? '' : unit}`.trim())}</title></rect>
            <text class="bv${now ? ' now' : ''}" x="${cx}" y="${(base - h - 4).toFixed(1)}">${vcEsc(label(v))}</text>
            <text class="ml${now ? ' now' : ''}" x="${cx}" y="${H - 4}">${vcEsc(name)}</text></g>`;
      })
      .join('');
    return `
        <div class="chart">
          <div class="chead"><span class="ctitle">${vcEsc(this._t(`chart_${metric}`))}<small>${vcEsc(unit)}</small></span>
            <span class="cspan">${vcEsc(this._t('last_months', { n }))}</span></div>
          <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${vcEsc(this._t(`chart_${metric}`))}">
            <line class="base" x1="0" x2="${W}" y1="${base + 0.5}" y2="${base + 0.5}"></line>
            ${bars}
          </svg>
        </div>`;
  }

  _sections(a, kind, f) {
    const c = this._config;
    const out = [];
    if (c.trips !== false) {
      const trips = (Array.isArray(a.trips) ? a.trips : []).slice(0, VC_ROWS);
      const rows = trips.map((t) => {
        const cons = this._cons(t, kind, f)
          .filter((l) => l.v !== VC_DASH)
          .map((l) => `${l.v} ${l.unit}`)
          .join(' · ');
        return this._row(f.date(t.start), vcFinite(t.distance) ? `${f.num(t.distance, 1)} km` : VC_DASH, cons || VC_DASH, f.money(t.cost));
      });
      out.push(this._section('trips', 'mdi:map-marker-path', this._t('recent_trips'), a.trips?.length || 0, rows, 'no_trips'));
    }
    if (c.refuels !== false) {
      const t = vcTracks(kind);
      const events = (list, key, unit) =>
        (Array.isArray(list) ? list : []).slice(0, VC_ROWS).map((e) => {
          const from = e.source === 'manual' || e.source === 'charger' ? this._t(e.source) : '';
          const sub = [vcFinite(e.odometer) ? `${f.num(e.odometer, 0)} km` : '', from]
            .filter(Boolean)
            .join(' · ');
          return this._row(f.date(e.time), sub || VC_DASH, vcFinite(e[key]) ? `${f.num(e[key], 1)} ${unit}` : VC_DASH, f.money(e.cost), e.source === 'manual');
        });
      if (t.fuel) out.push(this._section('refuels', 'mdi:gas-station', this._t('refuels'), a.refuels?.length || 0, events(a.refuels, 'liters', 'L'), 'no_refuels'));
      if (t.energy) out.push(this._section('charges', 'mdi:ev-station', this._t('charges'), a.charges?.length || 0, events(a.charges, 'energy', 'kWh'), 'no_charges'));
    }
    return out.length ? `<div class="sections">${out.join('')}</div>` : '';
  }

  _row(main, sub, value, cost, manual = false) {
    return `
              <div class="row${manual ? ' manual' : ''}">
                <span class="txt"><span class="name">${vcEsc(main)}</span><span class="sub">${vcEsc(sub)}</span></span>
                <span class="val"><span class="v">${vcEsc(value)}</span><span class="sub">${vcEsc(cost)}</span></span>
              </div>`;
  }

  // A collapsible section: chevron right when folded, down when open.
  _section(key, icon, label, count, rows, emptyKey) {
    const open = this._open.has(key);
    return `
          <section class="section${open ? ' open' : ''}" data-section="${key}">
            <button class="fold" data-key="${key}" aria-expanded="${open}">
              <ha-icon class="chev" icon="mdi:chevron-right"></ha-icon>
              <ha-icon class="sic" icon="${icon}"></ha-icon>
              <span class="slabel">${vcEsc(label)}</span>
              <span class="count">${count}</span>
            </button>
            <div class="body"><div class="inner">${rows.length ? rows.join('') : `<div class="none">${vcEsc(this._t(emptyKey))}</div>`}</div></div>
          </section>`;
  }

  _toggle(key) {
    if (this._open.has(key)) this._open.delete(key);
    else this._open.add(key);
    this._applyFold();
  }

  // A click anywhere outside an open section folds it back.
  _foldOutside(ev) {
    if (!this._open.size) return;
    const path = ev?.composedPath?.() || [];
    const inside = new Set(path.map((n) => n?.dataset?.section).filter(Boolean));
    let changed = false;
    for (const key of [...this._open]) {
      if (!inside.has(key)) {
        this._open.delete(key);
        changed = true;
      }
    }
    if (changed) this._applyFold();
  }

  // Sections fold in place (the transition plays); the signature keeps the state for the next render.
  _applyFold() {
    for (const el of this.shadowRoot?.querySelectorAll?.('.section') || []) {
      const open = this._open.has(el.dataset.section);
      el.classList.toggle('open', open);
      el.querySelector('.fold')?.setAttribute('aria-expanded', String(open));
    }
    this._sig = null;
  }

  // ── Log a refuel / a charge ──
  _openPopup() {
    const kind = this._attrs?.kind;
    if (!this._attrs?.entry_id) return;
    this._popup = { mode: kind === 'electric' ? 'charge' : 'refuel', values: {}, error: '', busy: false };
    document.addEventListener('keydown', this._onKey);
    this._render(true);
  }

  _closePopup() {
    if (!this._popup) return;
    this._popup = null;
    document.removeEventListener('keydown', this._onKey);
    this._render(true);
  }

  _setMode(mode) {
    if (!this._popup || this._popup.mode === mode) return;
    this._popup.mode = mode;
    this._popup.values.amount = '';
    this._popup.error = '';
    this._render(true);
  }

  _input(name, value) {
    if (!this._popup) return;
    this._popup.values[name] = value;
    const save = this.shadowRoot?.querySelector?.('[data-act="save"]');
    if (save) save.disabled = !this._payload();
  }

  // The service and its data, or null while the amount is missing or invalid.
  _payload() {
    const p = this._popup;
    const amount = vcParse(p?.values.amount);
    if (!p || amount == null || amount <= 0) return null;
    const charge = p.mode === 'charge';
    const data = { config_entry_id: this._attrs.entry_id, [charge ? 'energy' : 'liters']: amount };
    const cost = vcParse(p.values.cost);
    const odometer = vcParse(p.values.odometer);
    if (cost != null && cost >= 0) data.cost = cost;
    if (odometer != null && odometer >= 0) data.odometer = odometer;
    return { service: charge ? 'add_charge' : 'add_refuel', data };
  }

  async _save() {
    const p = this._popup;
    const call = this._payload();
    if (!p || !call || p.busy) return;
    p.busy = true;
    try {
      await this._hass.callService('vehicle_consumption', call.service, call.data);
      if (this._popup === p) this._closePopup();
    } catch (err) {
      p.busy = false;
      p.error = this._t('save_error', { e: err?.message || String(err) });
      if (this._popup === p) this._render(true);
    }
  }

  _popupHtml(a, kind, f) {
    const p = this._popup;
    const charge = p.mode === 'charge';
    const title = this._t(charge ? 'add_charge' : 'add_refuel');
    const field = (name, label, unit, placeholder = '', optional = false) => `
            <label class="field">
              <span class="flabel">${vcEsc(label)}${optional ? ` <i>${vcEsc(this._t('optional'))}</i>` : ''}</span>
              <span class="fbox"><input name="${name}" inputmode="decimal" autocomplete="off" value="${vcEsc(p.values[name] ?? '')}" placeholder="${vcEsc(placeholder)}"><em>${vcEsc(unit)}</em></span>
            </label>`;
    const tab = (mode, icon) =>
      `<button class="tab${p.mode === mode ? ' on' : ''}" data-mode="${mode}" aria-pressed="${p.mode === mode}"><ha-icon icon="${icon}"></ha-icon>${vcEsc(this._t(`mode_${mode}`))}</button>`;
    return `
        <div class="veil" data-act="cancel"></div>
        <div class="sheet" role="dialog" aria-label="${vcEsc(title)}">
          <div class="shead">
            <span class="ic"><ha-icon icon="${charge ? 'mdi:ev-station' : 'mdi:gas-station'}"></ha-icon></span>
            <span class="stitle">${vcEsc(title)}</span>
            <button class="icon-btn" data-act="cancel" title="${vcEsc(this._t('cancel'))}" aria-label="${vcEsc(this._t('cancel'))}"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
          ${kind === 'plugin_hybrid' ? `<div class="tabs" role="group">${tab('refuel', 'mdi:gas-station')}${tab('charge', 'mdi:ev-station')}</div>` : ''}
          <div class="fields">
            ${field('amount', this._t(charge ? 'energy' : 'liters'), charge ? 'kWh' : 'L')}
            ${field('cost', this._t('total_cost'), f.symbol() || a.currency || '', '', true)}
            ${field('odometer', this._t('odometer'), 'km', vcFinite(a.odometer) ? f.num(a.odometer, 0) : '', true)}
          </div>
          ${p.error ? `<div class="err">${vcEsc(p.error)}</div>` : ''}
          <div class="actions">
            <button class="btn" data-act="cancel">${vcEsc(this._t('cancel'))}</button>
            <button class="btn accent" data-act="save"${this._payload() ? '' : ' disabled'}>${vcEsc(this._t('save'))}</button>
          </div>
        </div>`;
  }

  static get styles() {
    return `
      :host {
        --vc-ok: var(--primary-color, #03a9f4);
        --vc-drive: var(--success-color, #43a047);
        --vc-warn: var(--warning-color, #ffa600);
        --vc-na: var(--disabled-color, #9e9e9e);
        --vc-fuel: var(--vc-fuel-color, #f59e0b);
        --vc-battery: var(--vc-battery-color, #22c55e);
      }
      ha-card { position: relative; padding: 12px; overflow: hidden; container-type: inline-size; }
      ha-card.lvl-ok    { --c: var(--vc-ok); }
      ha-card.lvl-drive { --c: var(--vc-drive); }
      ha-card.lvl-warn  { --c: var(--vc-warn); }
      ha-card.lvl-na    { --c: var(--vc-na); }
      ha-card.has-popup { min-height: 360px; }

      .head { display: flex; align-items: center; gap: 10px; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      .title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 500;
               color: var(--primary-text-color); white-space: nowrap; }
      .tname { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .pill { flex: none; font-size: 11px; font-weight: 500; padding: 1px 8px; border-radius: 999px; white-space: nowrap;
              color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); font-variant-numeric: tabular-nums; }
      .icon-btn { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
                  display: grid; place-items: center; color: var(--secondary-text-color); }
      .icon-btn:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .icon-btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .icon-btn ha-icon { --mdc-icon-size: 18px; }
      .empty { margin-top: 10px; font-size: 13px; color: var(--secondary-text-color); }

      /* Driving: a pulsing dot next to the name */
      .drive { position: relative; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--vc-drive); }
      .drive::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--vc-drive);
                      animation: vc-pulse 1.6s ease-out infinite; }

      .gauges { display: grid; gap: 8px; margin-top: 12px; }
      .gauge { --t: var(--vc-fuel); display: grid; grid-template-columns: 28px 1fr auto; grid-template-rows: auto auto;
               column-gap: 10px; row-gap: 5px; align-items: center; }
      .gauge.g-battery { --t: var(--vc-battery); }
      .gauge.low { --t: var(--vc-warn); }
      .ic { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: var(--t, var(--c)); background: color-mix(in srgb, var(--t, var(--c)) 18%, transparent); }
      .gauge .ic { grid-row: span 2; }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .glabel { font-size: 13px; font-weight: 500; color: var(--primary-text-color); line-height: 1.2; }
      .gval { font-size: 12px; font-weight: 500; color: var(--primary-text-color); font-variant-numeric: tabular-nums; line-height: 1.2; }
      .gauge.low .gval { color: var(--t); }
      .track { grid-column: 2 / 4; height: 6px; border-radius: 3px; overflow: hidden;
               background: color-mix(in srgb, var(--secondary-text-color) 18%, transparent); }
      .fill { display: block; height: 100%; border-radius: 3px; transform-origin: left center;
              background: linear-gradient(90deg, color-mix(in srgb, var(--t) 70%, transparent), var(--t)); }
      .anim .fill { animation: vc-fill 1.1s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--vc-t, 0ms); }

      .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 12px; }
      @container (min-width: 560px) { .kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      .kpi { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 8px 10px; border-radius: 10px;
             background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .kl { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; color: var(--secondary-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .kl ha-icon { --mdc-icon-size: 14px; flex: none; }
      .kv { font-size: 17px; font-weight: 600; line-height: 1.25; color: var(--primary-text-color);
            font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .kv small { margin-left: 3px; font-size: 11px; font-weight: 500; color: var(--secondary-text-color); }
      .ks { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            font-variant-numeric: tabular-nums; }

      .chart { margin-top: 12px; padding: 10px 10px 4px; border-radius: 10px;
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .chead { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
      .ctitle { font-size: 12px; font-weight: 500; color: var(--primary-text-color); }
      .ctitle small { margin-left: 6px; font-weight: 400; color: var(--secondary-text-color); }
      .cspan { font-size: 11px; color: var(--secondary-text-color); }
      .chart svg { display: block; width: 100%; height: auto; overflow: visible; }
      .chart .base { stroke: var(--divider-color, rgba(127,127,127,.25)); stroke-width: 1; }
      .chart .bar { fill: color-mix(in srgb, var(--secondary-text-color) 32%, transparent); transform-box: fill-box; transform-origin: 50% 100%; }
      .chart .bar.now { fill: var(--primary-color, #03a9f4); }
      .chart .bar.stub { fill: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
      .chart .col:hover .bar:not(.stub):not(.now) { fill: color-mix(in srgb, var(--secondary-text-color) 48%, transparent); }
      .anim .chart .bar:not(.stub) { animation: vc-grow .8s cubic-bezier(.2,.8,.2,1) both;
                                     animation-delay: calc(var(--vc-t, 0ms) + 200ms + var(--i, 0) * 70ms); }
      .anim .chart .bv { animation: vc-fade .4s ease-out both; animation-delay: calc(var(--vc-t, 0ms) + 800ms + var(--i, 0) * 70ms); }
      .chart text { font-size: 10px; text-anchor: middle; fill: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
      .chart .bv { font-size: 9.5px; }
      .chart text.now { fill: var(--primary-color, #03a9f4); font-weight: 600; }

      .sections { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
      .section { border-radius: 10px; background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .fold { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: flex; align-items: center; gap: 8px;
              padding: 8px 10px 8px 6px; border-radius: 10px; font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
      .fold:hover { background: color-mix(in srgb, var(--secondary-text-color) 8%, transparent); }
      .fold:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .chev { --mdc-icon-size: 18px; color: var(--secondary-text-color); transition: transform .2s ease; }
      .section.open .chev { transform: rotate(90deg); color: var(--primary-color); }
      .sic { --mdc-icon-size: 16px; color: var(--secondary-text-color); }
      .slabel { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .count { font-size: 11px; font-weight: 500; padding: 0 7px; border-radius: 999px; color: var(--secondary-text-color);
               background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
      .body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .25s ease; }
      .section.open .body { grid-template-rows: 1fr; }
      .inner { overflow: hidden; min-height: 0; }
      .section.open .inner { padding: 0 10px 6px; }
      .row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--divider-color, rgba(127,127,127,.15)); }
      .txt, .val { display: flex; flex-direction: column; min-width: 0; }
      .txt { flex: 1; }
      .val { flex: none; align-items: flex-end; }
      .name, .v { font-size: 13px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color); white-space: nowrap;
                  overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
      .sub { font-size: 11px; line-height: 1.25; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden;
             text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
      .row.manual .txt .sub { color: var(--primary-color); }
      .none { padding: 8px 0 4px; font-size: 12px; color: var(--secondary-text-color); border-top: 1px solid var(--divider-color, rgba(127,127,127,.15)); }

      /* The popup: anchored at the top of the card, over a smoked veil */
      .veil { position: absolute; inset: 0; z-index: 2; cursor: pointer;
              background: color-mix(in srgb, var(--card-background-color, #fff) 55%, transparent);
              -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: vc-fade .18s ease-out both; }
      .sheet { position: absolute; top: 8px; left: 8px; right: 8px; z-index: 3; box-sizing: border-box; padding: 12px;
               border-radius: 14px; border: 1px solid var(--divider-color, rgba(127,127,127,.2));
               background: color-mix(in srgb, var(--card-background-color, #fff) 92%, transparent);
               -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
               box-shadow: 0 10px 30px rgba(0,0,0,.18); animation: vc-drop .22s cubic-bezier(.2,.8,.2,1) both; }
      .shead { display: flex; align-items: center; gap: 10px; }
      .shead .ic { --t: var(--primary-color); }
      .stitle { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; color: var(--primary-text-color); }
      .tabs { display: flex; gap: 4px; margin-top: 12px; padding: 3px; border-radius: 12px;
              background: var(--secondary-background-color, rgba(128,128,128,.1)); }
      .tab { all: unset; cursor: pointer; flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
             padding: 6px 12px; border-radius: 9px; font-size: 13px; font-weight: 500; color: var(--secondary-text-color); }
      .tab ha-icon { --mdc-icon-size: 16px; }
      .tab.on { background: color-mix(in srgb, var(--primary-color) 15%, transparent); color: var(--primary-color); }
      .tab:focus-visible, .btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .fields { display: grid; gap: 10px; margin-top: 12px; }
      .field { display: flex; flex-direction: column; gap: 4px; }
      .flabel { font-size: 12px; font-weight: 500; color: var(--secondary-text-color); }
      .flabel i { font-style: normal; font-weight: 400; opacity: .75; }
      .fbox { display: flex; align-items: center; gap: 6px; padding: 0 12px; border-radius: 10px;
              border: 1px solid var(--divider-color, rgba(127,127,127,.3)); background: transparent; }
      .fbox:focus-within { border-color: var(--primary-color); box-shadow: 0 0 0 1px var(--primary-color); }
      .fbox input { all: unset; flex: 1; min-width: 0; padding: 9px 0; font-size: 14px; color: var(--primary-text-color);
                    font-variant-numeric: tabular-nums; }
      .fbox input::placeholder { color: var(--secondary-text-color); opacity: .6; }
      .fbox em { font-style: normal; font-size: 12px; color: var(--secondary-text-color); }
      .err { margin-top: 10px; font-size: 12px; color: var(--error-color, #db4437); }
      .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
      .btn { all: unset; cursor: pointer; padding: 7px 16px; border-radius: 999px; font-size: 13px; font-weight: 500;
             color: var(--primary-text-color); border: 1px solid var(--divider-color, rgba(127,127,127,.35)); }
      .btn:hover { background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
      .btn.accent { color: var(--primary-color); border-color: color-mix(in srgb, var(--primary-color) 60%, transparent); }
      .btn.accent:hover { background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
      .btn[disabled] { cursor: default; opacity: .45; background: none; }

      @keyframes vc-pulse { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(3); opacity: 0 } }
      @keyframes vc-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
      @keyframes vc-grow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
      @keyframes vc-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes vc-drop { from { opacity: 0; transform: translateY(-10px) } to { opacity: 1; transform: none } }
      @media (prefers-reduced-motion: reduce) {
        .drive::after, .anim .fill, .anim .chart .bar, .anim .chart .bv, .veil, .sheet { animation: none !important; }
        .chev, .body { transition: none; }
      }
    `;
  }
}

// ── Editor ───────────────────────────────────────────────────────────────────
const VC_HELPERS = ['entity', 'title', 'language'];

class VehicleConsumptionCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _update() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      const t = (key) => vcT(vcLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (VC_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
      this._form.addEventListener('value-changed', (ev) => {
        const config = { ...ev.detail.value };
        // Options left at their default are not written to the YAML.
        for (const k of Object.keys(config)) {
          if (config[k] === '' || config[k] == null || VC_DEFAULTS[k] === config[k]) delete config[k];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const c = this._config;
    const lang = vcLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    // The vehicles found, plus a configured sensor that is not (yet) among them, so the choice is never lost.
    const vehicles = vcVehicles(this._hass).map((v) => ({ value: v.entity, label: v.name }));
    if (c.entity && !vehicles.some((v) => v.value === c.entity)) {
      vehicles.push({ value: c.entity, label: vcVehicleName(this._hass.states?.[c.entity], c.entity) });
    }
    const key = JSON.stringify(vehicles);
    if (this._deps && this._deps.config === c && this._deps.lang === lang && this._deps.key === key) return;
    this._deps = { config: c, lang, key };
    this._form.data = { ...VC_DEFAULTS, ...c };
    this._form.schema = [
      { name: 'entity', selector: { select: { mode: 'dropdown', options: vehicles } } },
      { name: 'title', selector: { text: {} } },
      { name: 'chart', selector: { boolean: {} } },
      {
        name: 'chart_metric',
        selector: {
          select: { mode: 'dropdown', options: VC_METRICS.map((m) => ({ value: m, label: vcT(lang, `chart_${m}`) })) },
        },
      },
      { name: 'months', selector: { number: { min: 3, max: 12, mode: 'slider' } } },
      { name: 'trips', selector: { boolean: {} } },
      { name: 'refuels', selector: { boolean: {} } },
      { name: 'add_button', selector: { boolean: {} } },
      {
        name: 'language',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
              { value: 'de', label: 'Deutsch' },
              { value: 'es', label: 'Español' },
              { value: 'it', label: 'Italiano' },
              { value: 'nl', label: 'Nederlands' },
              { value: 'pt', label: 'Português (Portugal)' },
              { value: 'pl', label: 'Polski' },
              { value: 'sr', label: 'Српски' },
              { value: 'sr-Latn', label: 'Srpski (latinica)' },
            ],
          },
        },
      },
    ];
  }
}

if (!customElements.get('vehicle-consumption-card')) {
  customElements.define('vehicle-consumption-card', VehicleConsumptionCard);
  customElements.define('vehicle-consumption-card-editor', VehicleConsumptionCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'vehicle-consumption-card',
    name: 'Vehicle Consumption Card',
    description: 'Fuel and energy consumption of a vehicle: gauges, trips, monthly chart, refuels and charges',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-vehicle-consumption',
  });
  console.info(
    `%c VEHICLE-CONSUMPTION-CARD %c v${VEHICLE_CONSUMPTION_CARD_VERSION} `,
    'background:#0ea5e9;color:#fff;font-weight:700',
    '',
  );
}
