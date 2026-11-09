/**
 * vehicle-consumption-card — the fuel and energy consumption tracked by the Vehicle Consumption integration:
 * tank and battery gauges, last trip, this month, average, cost per km, a monthly chart, the recent trips and the
 * refuels / charges, with a popup to log a refuel or a charge by hand. vehicle-consumption-mini-card: the compact view
 * (gauges, last trip, average), whose detail button opens the full card.
 * Served and added to the dashboard resources by the integration.
 * https://github.com/juju35/ha-vehicle-consumption
 */
var VEHICLE_CONSUMPTION_CARD_VERSION = '1.7.1';

const VC_I18N = {
  en: {
    title: 'Vehicle',
    not_loaded: 'Not set up',
    not_loaded_hint: 'Vehicle Consumption is not set up: add a vehicle in Settings → Devices & services',
    unavailable: 'Unavailable',
    unavailable_hint: '{entity} is unavailable: Vehicle Consumption may be starting or reloading',
    not_found: 'Not found',
    not_found_hint: '{entity} is not a Vehicle Consumption sensor or does not exist: check the card options',
    driving: 'Driving',
    fuel: 'Fuel',
    battery: 'Battery',
    trip: 'Last trip',
    trip_now: 'Current trip',
    month: 'This month',
    average: 'Average',
    cost_km: 'Cost per {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Vehicle Consumption Card',
    card_desc: 'Fuel and energy consumption of a vehicle: gauges, trips, monthly chart, refuels and charges',
    mini_name: 'Vehicle Consumption Mini Card',
    mini_desc: 'Compact view of a vehicle: tank and battery, last trip and average consumption',
    zoom_in: 'Show details',
    zoom_out: 'Back to the compact view',
    ed_zoom: 'Details button (full view)',
    estimated: 'Estimated',
  },
  fr: {
    title: 'Véhicule',
    not_loaded: 'Non configuré',
    not_loaded_hint: 'Vehicle Consumption n’est pas configuré : ajouter un véhicule dans Paramètres → Appareils et services',
    unavailable: 'Indisponible',
    unavailable_hint: '{entity} est indisponible : Vehicle Consumption est peut-être en train de démarrer ou de se recharger',
    not_found: 'Introuvable',
    not_found_hint: '{entity} n’est pas un capteur Vehicle Consumption ou n’existe pas : vérifier les options de la carte',
    driving: 'En route',
    fuel: 'Carburant',
    battery: 'Batterie',
    trip: 'Dernier trajet',
    trip_now: 'Trajet en cours',
    month: 'Ce mois-ci',
    average: 'Moyenne',
    cost_km: 'Coût au {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Carte consommation véhicule',
    card_desc: 'Consommation de carburant et d’énergie d’un véhicule : jauges, trajets, graphique mensuel, pleins et recharges',
    mini_name: 'Mini-carte consommation véhicule',
    mini_desc: 'Vue compacte d’un véhicule : réservoir et batterie, dernier trajet et consommation moyenne',
    zoom_in: 'Afficher les détails',
    zoom_out: 'Revenir à la vue compacte',
    ed_zoom: 'Bouton détails (vue complète)',
    estimated: 'Estimé',
  },
  de: {
    title: 'Fahrzeug',
    not_loaded: 'Nicht eingerichtet',
    not_loaded_hint: 'Vehicle Consumption ist nicht eingerichtet: Fahrzeug unter Einstellungen → Geräte & Dienste hinzufügen',
    unavailable: 'Nicht verfügbar',
    unavailable_hint: '{entity} ist nicht verfügbar: Vehicle Consumption startet oder lädt möglicherweise gerade neu',
    not_found: 'Nicht gefunden',
    not_found_hint: '{entity} ist kein Vehicle-Consumption-Sensor oder existiert nicht: Kartenoptionen prüfen',
    driving: 'Unterwegs',
    fuel: 'Kraftstoff',
    battery: 'Batterie',
    trip: 'Letzte Fahrt',
    trip_now: 'Aktuelle Fahrt',
    month: 'Diesen Monat',
    average: 'Durchschnitt',
    cost_km: 'Kosten pro {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Fahrzeugverbrauch-Karte',
    card_desc: 'Kraftstoff- und Energieverbrauch eines Fahrzeugs: Anzeigen, Fahrten, Monatsdiagramm, Tank- und Ladevorgänge',
    mini_name: 'Fahrzeugverbrauch-Minikarte',
    mini_desc: 'Kompakte Ansicht eines Fahrzeugs: Tank und Akku, letzte Fahrt und Durchschnittsverbrauch',
    zoom_in: 'Details anzeigen',
    zoom_out: 'Zurück zur kompakten Ansicht',
    ed_zoom: 'Detail-Schaltfläche (vollständige Ansicht)',
    estimated: 'Geschätzt',
  },
  es: {
    title: 'Vehículo',
    not_loaded: 'No configurado',
    not_loaded_hint: 'Vehicle Consumption no está configurado: añade un vehículo en Ajustes → Dispositivos y servicios',
    unavailable: 'No disponible',
    unavailable_hint: '{entity} no está disponible: puede que Vehicle Consumption se esté iniciando o recargando',
    not_found: 'No encontrado',
    not_found_hint: '{entity} no es un sensor de Vehicle Consumption o no existe: revisa las opciones de la tarjeta',
    driving: 'En marcha',
    fuel: 'Combustible',
    battery: 'Batería',
    trip: 'Último trayecto',
    trip_now: 'Trayecto en curso',
    month: 'Este mes',
    average: 'Media',
    cost_km: 'Coste por {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Tarjeta de consumo del vehículo',
    card_desc: 'Consumo de combustible y energía de un vehículo: indicadores, trayectos, gráfico mensual, repostajes y cargas',
    mini_name: 'Minitarjeta de consumo del vehículo',
    mini_desc: 'Vista compacta de un vehículo: depósito y batería, último trayecto y consumo medio',
    zoom_in: 'Mostrar detalles',
    zoom_out: 'Volver a la vista compacta',
    ed_zoom: 'Botón de detalles (vista completa)',
    estimated: 'Estimado',
  },
  it: {
    title: 'Veicolo',
    not_loaded: 'Non configurato',
    not_loaded_hint: 'Vehicle Consumption non è configurato: aggiungi un veicolo in Impostazioni → Dispositivi e servizi',
    unavailable: 'Non disponibile',
    unavailable_hint: '{entity} non è disponibile: Vehicle Consumption potrebbe essere in fase di avvio o di ricaricamento',
    not_found: 'Non trovato',
    not_found_hint: '{entity} non è un sensore di Vehicle Consumption o non esiste: controlla le opzioni della scheda',
    driving: 'In marcia',
    fuel: 'Carburante',
    battery: 'Batteria',
    trip: 'Ultimo viaggio',
    trip_now: 'Viaggio in corso',
    month: 'Questo mese',
    average: 'Media',
    cost_km: 'Costo al {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Scheda consumo veicolo',
    card_desc: 'Consumo di carburante ed energia di un veicolo: indicatori, viaggi, grafico mensile, rifornimenti e ricariche',
    mini_name: 'Mini scheda consumo veicolo',
    mini_desc: 'Vista compatta di un veicolo: serbatoio e batteria, ultimo viaggio e consumo medio',
    zoom_in: 'Mostra dettagli',
    zoom_out: 'Torna alla vista compatta',
    ed_zoom: 'Pulsante dettagli (vista completa)',
    estimated: 'Stimato',
  },
  nl: {
    title: 'Voertuig',
    not_loaded: 'Niet ingesteld',
    not_loaded_hint: 'Vehicle Consumption is niet ingesteld: voeg een voertuig toe via Instellingen → Apparaten & diensten',
    unavailable: 'Niet beschikbaar',
    unavailable_hint: '{entity} is niet beschikbaar: Vehicle Consumption wordt mogelijk gestart of opnieuw geladen',
    not_found: 'Niet gevonden',
    not_found_hint: '{entity} is geen Vehicle Consumption-sensor of bestaat niet: controleer de kaartopties',
    driving: 'Onderweg',
    fuel: 'Brandstof',
    battery: 'Accu',
    trip: 'Laatste rit',
    trip_now: 'Huidige rit',
    month: 'Deze maand',
    average: 'Gemiddeld',
    cost_km: 'Kosten per {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Voertuigverbruikkaart',
    card_desc: 'Brandstof- en energieverbruik van een voertuig: meters, ritten, maandgrafiek, tank- en laadbeurten',
    mini_name: 'Voertuigverbruik-minikaart',
    mini_desc: 'Compacte weergave van een voertuig: tank en accu, laatste rit en gemiddeld verbruik',
    zoom_in: 'Details tonen',
    zoom_out: 'Terug naar de compacte weergave',
    ed_zoom: 'Detailknop (volledige weergave)',
    estimated: 'Geschat',
  },
  pt: {
    title: 'Veículo',
    not_loaded: 'Não configurado',
    not_loaded_hint: 'O Vehicle Consumption não está configurado: adicione um veículo em Definições → Dispositivos e serviços',
    unavailable: 'Indisponível',
    unavailable_hint: '{entity} está indisponível: o Vehicle Consumption pode estar a iniciar ou a recarregar',
    not_found: 'Não encontrado',
    not_found_hint: '{entity} não é um sensor do Vehicle Consumption ou não existe: verifique as opções do cartão',
    driving: 'Em viagem',
    fuel: 'Combustível',
    battery: 'Bateria',
    trip: 'Última viagem',
    trip_now: 'Viagem em curso',
    month: 'Este mês',
    average: 'Média',
    cost_km: 'Custo por {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Cartão de consumo do veículo',
    card_desc: 'Consumo de combustível e energia de um veículo: indicadores, viagens, gráfico mensal, abastecimentos e carregamentos',
    mini_name: 'Mini cartão de consumo do veículo',
    mini_desc: 'Vista compacta de um veículo: depósito e bateria, última viagem e consumo médio',
    zoom_in: 'Mostrar detalhes',
    zoom_out: 'Voltar à vista compacta',
    ed_zoom: 'Botão de detalhes (vista completa)',
    estimated: 'Estimado',
  },
  pl: {
    title: 'Pojazd',
    not_loaded: 'Nieskonfigurowane',
    not_loaded_hint: 'Vehicle Consumption nie jest skonfigurowane: dodaj pojazd w Ustawienia → Urządzenia oraz usługi',
    unavailable: 'Niedostępne',
    unavailable_hint: 'Encja {entity} jest niedostępna: Vehicle Consumption może się właśnie uruchamiać lub przeładowywać',
    not_found: 'Nie znaleziono',
    not_found_hint: 'Encja {entity} nie jest sensorem Vehicle Consumption lub nie istnieje: sprawdź opcje karty',
    driving: 'W trasie',
    fuel: 'Paliwo',
    battery: 'Akumulator',
    trip: 'Ostatnia trasa',
    trip_now: 'Bieżąca trasa',
    month: 'Ten miesiąc',
    average: 'Średnio',
    cost_km: 'Koszt za {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Karta zużycia pojazdu',
    card_desc: 'Zużycie paliwa i energii pojazdu: wskaźniki, przejazdy, wykres miesięczny, tankowania i ładowania',
    mini_name: 'Mini karta zużycia pojazdu',
    mini_desc: 'Kompaktowy widok pojazdu: zbiornik i akumulator, ostatni przejazd i średnie zużycie',
    zoom_in: 'Pokaż szczegóły',
    zoom_out: 'Wróć do widoku kompaktowego',
    ed_zoom: 'Przycisk szczegółów (pełny widok)',
    estimated: 'Szacowany',
  },
  ro: {
    title: 'Vehicul',
    not_loaded: 'Neconfigurat',
    not_loaded_hint: 'Vehicle Consumption nu este configurat: adaugă un vehicul în Setări → Dispozitive și servicii',
    unavailable: 'Indisponibil',
    unavailable_hint: '{entity} nu este disponibil: este posibil ca Vehicle Consumption să pornească sau să se reîncarce',
    not_found: 'Negăsit',
    not_found_hint: '{entity} nu este un senzor Vehicle Consumption sau nu există: verifică opțiunile cardului',
    driving: 'În mers',
    fuel: 'Combustibil',
    battery: 'Baterie',
    trip: 'Ultima călătorie',
    trip_now: 'Călătorie în curs',
    month: 'Luna aceasta',
    average: 'Medie',
    cost_km: 'Cost pe {u}',
    month_cost: '{v} luna asta',
    recent_trips: 'Călătorii recente',
    refuels: 'Alimentări',
    charges: 'Încărcări',
    no_trips: 'Încă nicio călătorie',
    no_refuels: 'Încă nicio alimentare',
    no_charges: 'Încă nicio încărcare',
    manual: 'Manual',
    charger: 'Încărcător de acasă',
    chart_consumption: 'Consum',
    chart_distance: 'Distanță',
    chart_cost: 'Cost',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Ultimele {n} luni',
    add: 'Adaugă o alimentare sau o încărcare',
    add_refuel: 'Adaugă o alimentare',
    add_charge: 'Adaugă o încărcare',
    mode_refuel: 'Carburant',
    mode_charge: 'Încărcare',
    liters: 'Combustibil adăugat',
    energy: 'Energie adăugată',
    total_cost: 'Cost total',
    odometer: 'Kilometraj',
    optional: 'opțional',
    save: 'Salvează',
    cancel: 'Anulează',
    save_error: 'Nu s-a putut salva: {e}',
    ed_entity: 'Vehicul',
    ed_entity_helper: 'Găsit automat; lasă gol pentru a folosi primul vehicul',
    ed_title: 'Titlu',
    ed_title_helper: 'Lasă gol pentru numele vehiculului',
    ed_chart: 'Grafic lunar',
    ed_chart_metric: 'Graficul arată',
    ed_months: 'Luni în grafic',
    ed_trips: 'Călătorii recente',
    ed_refuels: 'Alimentări și încărcări',
    ed_add_button: 'Butonul „Înregistrează o alimentare sau o încărcare”',
    ed_language: 'Limbă',
    ed_language_helper: 'Lasă gol pentru a urma Home Assistant',
    card_name: 'Card consum vehicul',
    card_desc: 'Consumul de combustibil și energie al unui vehicul: indicatoare, călătorii, grafic lunar, alimentări și încărcări',
    mini_name: 'Mini card consum vehicul',
    mini_desc: 'Vedere compactă a unui vehicul: rezervor și baterie, ultima călătorie și consumul mediu',
    zoom_in: 'Afișează detaliile',
    zoom_out: 'Înapoi la vederea compactă',
    ed_zoom: 'Buton detalii (vedere completă)',
    estimated: 'Estimat',
  },
  da: {
    title: 'Køretøj',
    not_loaded: 'Ikke konfigureret',
    not_loaded_hint: 'Vehicle Consumption er ikke konfigureret: tilføj et køretøj under Indstillinger → Enheder og tjenester',
    unavailable: 'Utilgængelig',
    unavailable_hint: '{entity} er utilgængelig: Vehicle Consumption er måske ved at starte eller genindlæse',
    not_found: 'Ikke fundet',
    not_found_hint: '{entity} er ikke en Vehicle Consumption-sensor eller findes ikke: tjek kortets indstillinger',
    driving: 'Kører',
    fuel: 'Brændstof',
    battery: 'Batteri',
    trip: 'Seneste tur',
    trip_now: 'Igangværende tur',
    month: 'Denne måned',
    average: 'Gennemsnit',
    cost_km: 'Pris pr. {u}',
    month_cost: '{v} denne md.',
    recent_trips: 'Seneste ture',
    refuels: 'Tankninger',
    charges: 'Opladninger',
    no_trips: 'Ingen ture endnu',
    no_refuels: 'Ingen tankninger endnu',
    no_charges: 'Ingen opladninger endnu',
    manual: 'Manuelt',
    charger: 'Hjemmelader',
    chart_consumption: 'Forbrug',
    chart_distance: 'Distance',
    chart_cost: 'Omkostning',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Seneste {n} måneder',
    add: 'Notér en tankning eller opladning',
    add_refuel: 'Notér en tankning',
    add_charge: 'Notér en opladning',
    mode_refuel: 'Brændstof',
    mode_charge: 'Ladning',
    liters: 'Tanket brændstof',
    energy: 'Tilført energi',
    total_cost: 'Samlet pris',
    odometer: 'Kilometertæller',
    optional: 'valgfri',
    save: 'Gem',
    cancel: 'Annuller',
    save_error: 'Kunne ikke gemme: {e}',
    ed_entity: 'Køretøj',
    ed_entity_helper: 'Findes automatisk; lad feltet stå tomt for at bruge det første køretøj',
    ed_title: 'Titel',
    ed_title_helper: 'Lad feltet stå tomt for køretøjets navn',
    ed_chart: 'Månedligt diagram',
    ed_chart_metric: 'Diagrammet viser',
    ed_months: 'Måneder i diagrammet',
    ed_trips: 'Seneste ture',
    ed_refuels: 'Tankninger og opladninger',
    ed_add_button: 'Knappen »Notér en tankning eller opladning«',
    ed_language: 'Sprog',
    ed_language_helper: 'Lad feltet stå tomt for at følge Home Assistant',
    card_name: 'Køretøjsforbrugskort',
    card_desc: 'Brændstof- og energiforbrug for et køretøj: målere, ture, månedsdiagram, tankninger og opladninger',
    mini_name: 'Køretøjsforbrug-minikort',
    mini_desc: 'Kompakt visning af et køretøj: tank og batteri, seneste tur og gennemsnitligt forbrug',
    zoom_in: 'Vis detaljer',
    zoom_out: 'Tilbage til kompakt visning',
    ed_zoom: 'Detaljeknap (fuld visning)',
    estimated: 'Anslået',
  },
  sv: {
    title: 'Fordon',
    not_loaded: 'Inte konfigurerad',
    not_loaded_hint: 'Vehicle Consumption är inte konfigurerat: lägg till ett fordon under Inställningar → Enheter och tjänster',
    unavailable: 'Inte tillgänglig',
    unavailable_hint: '{entity} är inte tillgänglig: Vehicle Consumption kanske startar eller läses in på nytt',
    not_found: 'Hittades inte',
    not_found_hint: '{entity} är ingen Vehicle Consumption-sensor eller finns inte: kontrollera kortets alternativ',
    driving: 'Kör',
    fuel: 'Bränsle',
    battery: 'Batteri',
    trip: 'Senaste resa',
    trip_now: 'Pågående resa',
    month: 'Denna månad',
    average: 'Genomsnitt',
    cost_km: 'Kostnad per {u}',
    month_cost: '{v} denna månad',
    recent_trips: 'Senaste resor',
    refuels: 'Tankningar',
    charges: 'Laddningar',
    no_trips: 'Inga resor än',
    no_refuels: 'Inga tankningar än',
    no_charges: 'Inga laddningar än',
    manual: 'Manuellt',
    charger: 'Hemmaladdare',
    chart_consumption: 'Förbrukning',
    chart_distance: 'Sträcka',
    chart_cost: 'Kostnad',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Senaste {n} månader',
    add: 'Registrera en tankning eller laddning',
    add_refuel: 'Registrera en tankning',
    add_charge: 'Registrera en laddning',
    mode_refuel: 'Bränsle',
    mode_charge: 'Laddning',
    liters: 'Tankat bränsle',
    energy: 'Tillförd energi',
    total_cost: 'Total kostnad',
    odometer: 'Vägmätare',
    optional: 'valfritt',
    save: 'Spara',
    cancel: 'Avbryt',
    save_error: 'Kunde inte spara: {e}',
    ed_entity: 'Fordon',
    ed_entity_helper: 'Hittas automatiskt; lämna tomt för att använda det första fordonet',
    ed_title: 'Titel',
    ed_title_helper: 'Lämna tomt för fordonets namn',
    ed_chart: 'Månadsdiagram',
    ed_chart_metric: 'Diagrammet visar',
    ed_months: 'Månader i diagrammet',
    ed_trips: 'Senaste resor',
    ed_refuels: 'Tankningar och laddningar',
    ed_add_button: 'Knappen ”Registrera en tankning eller laddning”',
    ed_language: 'Språk',
    ed_language_helper: 'Lämna tomt för att följa Home Assistant',
    card_name: 'Fordonsförbrukningskort',
    card_desc: 'Bränsle- och energiförbrukning för ett fordon: mätare, resor, månadsdiagram, tankningar och laddningar',
    mini_name: 'Fordonsförbrukning-minikort',
    mini_desc: 'Kompakt vy av ett fordon: tank och batteri, senaste resa och genomsnittlig förbrukning',
    zoom_in: 'Visa detaljer',
    zoom_out: 'Tillbaka till kompakt vy',
    ed_zoom: 'Detaljknapp (fullständig vy)',
    estimated: 'Uppskattad',
  },
  bg: {
    title: 'Автомобил',
    not_loaded: 'Не е конфигурирано',
    not_loaded_hint: 'Vehicle Consumption не е конфигуриран: добавете превозно средство в Настройки → Устройства и услуги',
    unavailable: 'Недостъпно',
    unavailable_hint: '{entity} е недостъпен: Vehicle Consumption може би се стартира или презарежда',
    not_found: 'Не е намерено',
    not_found_hint: '{entity} не е сензор на Vehicle Consumption или не съществува: проверете опциите на картата',
    driving: 'В движение',
    fuel: 'Гориво',
    battery: 'Батерия',
    trip: 'Посл. пътуване',
    trip_now: 'Текущо пътуване',
    month: 'Този месец',
    average: 'Средно',
    cost_km: 'Цена за {u}',
    month_cost: '{v} този месец',
    recent_trips: 'Пътувания',
    refuels: 'Танкувания',
    charges: 'Зареждания',
    no_trips: 'Все още няма пътувания',
    no_refuels: 'Все още няма танкувания',
    no_charges: 'Все още няма зареждания',
    manual: 'Ръчно',
    charger: 'Домашно зарядно',
    chart_consumption: 'Разход',
    chart_distance: 'Разстояние',
    chart_cost: 'Разходи',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Последните {n} месеца',
    add: 'Запиши танкуване или зареждане',
    add_refuel: 'Запиши танкуване',
    add_charge: 'Запиши зареждане',
    mode_refuel: 'Гориво',
    mode_charge: 'Зареждане',
    liters: 'Добавено гориво',
    energy: 'Добавена енергия',
    total_cost: 'Обща сума',
    odometer: 'Одометър',
    optional: 'по избор',
    save: 'Запази',
    cancel: 'Отказ',
    save_error: 'Неуспешно запазване: {e}',
    ed_entity: 'Превозно средство',
    ed_entity_helper: 'Намира се автоматично; оставете празно, за да се използва първото превозно средство',
    ed_title: 'Заглавие',
    ed_title_helper: 'Оставете празно за името на превозното средство',
    ed_chart: 'Месечна диаграма',
    ed_chart_metric: 'Диаграмата показва',
    ed_months: 'Месеци в диаграмата',
    ed_trips: 'Последни пътувания',
    ed_refuels: 'Зареждания с гориво и на батерията',
    ed_add_button: 'Бутон „Запиши зареждане с гориво или на батерията“',
    ed_language: 'Език',
    ed_language_helper: 'Оставете празно, за да се следва Home Assistant',
    card_name: 'Карта за разход на автомобила',
    card_desc: 'Разход на гориво и енергия на автомобил: индикатори, пътувания, месечна графика, зареждания с гориво и зареждания на батерията',
    mini_name: 'Мини карта за разход на автомобила',
    mini_desc: 'Компактен изглед на автомобил: резервоар и батерия, последно пътуване и среден разход',
    zoom_in: 'Покажи подробности',
    zoom_out: 'Обратно към компактния изглед',
    ed_zoom: 'Бутон за подробности (пълен изглед)',
    estimated: 'Приблизително',
  },
  ru: {
    title: 'Автомобиль',
    not_loaded: 'Не настроено',
    not_loaded_hint: 'Vehicle Consumption не настроен: добавьте автомобиль в Настройки → Устройства и службы',
    unavailable: 'Недоступно',
    unavailable_hint: '{entity} недоступен: возможно, Vehicle Consumption запускается или перезагружается',
    not_found: 'Не найдено',
    not_found_hint: '{entity} не является датчиком Vehicle Consumption или не существует: проверьте параметры карточки',
    driving: 'В движении',
    fuel: 'Топливо',
    battery: 'Батарея',
    trip: 'Посл. поездка',
    trip_now: 'Текущая поездка',
    month: 'Этот месяц',
    average: 'Среднее',
    cost_km: 'Стоимость на {u}',
    month_cost: '{v} в этом мес.',
    recent_trips: 'Поездки',
    refuels: 'Заправки',
    charges: 'Зарядки',
    no_trips: 'Поездок пока нет',
    no_refuels: 'Заправок пока нет',
    no_charges: 'Зарядок пока нет',
    manual: 'Вручную',
    charger: 'Домашняя зарядная станция',
    chart_consumption: 'Расход',
    chart_distance: 'Расстояние',
    chart_cost: 'Затраты',
    chart_co2: 'CO₂',
    co2_km: '{v} г CO₂/{u}',
    last_months: 'Последние месяцы: {n}',
    add: 'Записать заправку или зарядку',
    add_refuel: 'Записать заправку',
    add_charge: 'Записать зарядку',
    mode_refuel: 'Топливо',
    mode_charge: 'Зарядка',
    liters: 'Залитое топливо',
    energy: 'Полученная энергия',
    total_cost: 'Сумма',
    odometer: 'Одометр',
    optional: 'необязательно',
    save: 'Сохранить',
    cancel: 'Отмена',
    save_error: 'Не удалось сохранить: {e}',
    ed_entity: 'Автомобиль',
    ed_entity_helper: 'Находится автоматически; оставьте пустым, чтобы использовать первый автомобиль',
    ed_title: 'Заголовок',
    ed_title_helper: 'Оставьте пустым, чтобы использовать название автомобиля',
    ed_chart: 'Ежемесячная диаграмма',
    ed_chart_metric: 'Диаграмма показывает',
    ed_months: 'Месяцев на диаграмме',
    ed_trips: 'Недавние поездки',
    ed_refuels: 'Заправки и зарядки',
    ed_add_button: 'Кнопка «Записать заправку или зарядку»',
    ed_language: 'Язык',
    ed_language_helper: 'Оставьте пустым, чтобы следовать языку Home Assistant',
    card_name: 'Карточка расхода автомобиля',
    card_desc: 'Расход топлива и энергии автомобиля: индикаторы, поездки, месячный график, заправки и зарядки',
    mini_name: 'Мини-карточка расхода автомобиля',
    mini_desc: 'Компактный вид автомобиля: бак и батарея, последняя поездка и средний расход',
    zoom_in: 'Показать подробности',
    zoom_out: 'Вернуться к компактному виду',
    ed_zoom: 'Кнопка подробностей (полный вид)',
    estimated: 'Оценка',
  },
  uk: {
    title: 'Автомобіль',
    not_loaded: 'Не налаштовано',
    not_loaded_hint: 'Vehicle Consumption не налаштовано: додайте автомобіль у Налаштування → Пристрої та служби',
    unavailable: 'Недоступно',
    unavailable_hint: '{entity} недоступний: можливо, Vehicle Consumption запускається або перезавантажується',
    not_found: 'Не знайдено',
    not_found_hint: '{entity} не є датчиком Vehicle Consumption або не існує: перевірте параметри картки',
    driving: 'У русі',
    fuel: 'Пальне',
    battery: 'Батарея',
    trip: 'Остання поїздка',
    trip_now: 'Поточна поїздка',
    month: 'Цей місяць',
    average: 'Середнє',
    cost_km: 'Вартість за {u}',
    month_cost: '{v} цього міс.',
    recent_trips: 'Поїздки',
    refuels: 'Заправки',
    charges: 'Заряджання',
    no_trips: 'Поїздок ще немає',
    no_refuels: 'Заправок ще немає',
    no_charges: 'Заряджань ще немає',
    manual: 'Вручну',
    charger: 'Домашня зарядна станція',
    chart_consumption: 'Витрата',
    chart_distance: 'Відстань',
    chart_cost: 'Витрати',
    chart_co2: 'CO₂',
    co2_km: '{v} г CO₂/{u}',
    last_months: 'Останні місяці: {n}',
    add: 'Записати заправку або заряджання',
    add_refuel: 'Записати заправку',
    add_charge: 'Записати заряджання',
    mode_refuel: 'Пальне',
    mode_charge: 'Зарядка',
    liters: 'Залите пальне',
    energy: 'Отримана енергія',
    total_cost: 'Сума',
    odometer: 'Одометр',
    optional: "необов'язково",
    save: 'Зберегти',
    cancel: 'Скасувати',
    save_error: 'Не вдалося зберегти: {e}',
    ed_entity: 'Автомобіль',
    ed_entity_helper: 'Знаходиться автоматично; залиште порожнім, щоб використати перший автомобіль',
    ed_title: 'Заголовок',
    ed_title_helper: 'Залиште порожнім, щоб використати назву автомобіля',
    ed_chart: 'Щомісячна діаграма',
    ed_chart_metric: 'Діаграма показує',
    ed_months: 'Місяців на діаграмі',
    ed_trips: 'Нещодавні поїздки',
    ed_refuels: 'Заправки та заряджання',
    ed_add_button: 'Кнопка «Записати заправку або заряджання»',
    ed_language: 'Мова',
    ed_language_helper: 'Залиште порожнім, щоб використовувати мову Home Assistant',
    card_name: 'Картка витрати автомобіля',
    card_desc: 'Витрата пального та енергії автомобіля: індикатори, поїздки, місячний графік, заправки та заряджання',
    mini_name: 'Міні-картка витрати автомобіля',
    mini_desc: 'Компактний вигляд автомобіля: бак і батарея, остання поїздка та середня витрата',
    zoom_in: 'Показати подробиці',
    zoom_out: 'Повернутися до компактного вигляду',
    ed_zoom: 'Кнопка подробиць (повний вигляд)',
    estimated: 'Оцінка',
  },
  hu: {
    title: 'Jármű',
    not_loaded: 'Nincs beállítva',
    not_loaded_hint: 'A Vehicle Consumption nincs beállítva: adj hozzá egy járművet itt: Beállítások → Eszközök és szolgáltatások',
    unavailable: 'Nem érhető el',
    unavailable_hint: '{entity} nem érhető el: lehet, hogy a Vehicle Consumption éppen indul vagy újratöltődik',
    not_found: 'Nem található',
    not_found_hint: '{entity} nem Vehicle Consumption érzékelő, vagy nem létezik: ellenőrizd a kártya beállításait',
    driving: 'Úton',
    fuel: 'Üzemanyag',
    battery: 'Akkumulátor',
    trip: 'Utolsó út',
    trip_now: 'Jelenlegi út',
    month: 'Ez a hónap',
    average: 'Átlag',
    cost_km: 'Költség/{u}',
    month_cost: '{v} e hóban',
    recent_trips: 'Legutóbbi utak',
    refuels: 'Tankolások',
    charges: 'Töltések',
    no_trips: 'Még nincs út',
    no_refuels: 'Még nincs tankolás',
    no_charges: 'Még nincs töltés',
    manual: 'Kézi',
    charger: 'Otthoni töltő',
    chart_consumption: 'Fogyasztás',
    chart_distance: 'Távolság',
    chart_cost: 'Költség',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Utolsó {n} hónap',
    add: 'Tankolás vagy töltés rögzítése',
    add_refuel: 'Tankolás rögzítése',
    add_charge: 'Töltés rögzítése',
    mode_refuel: 'Üzemanyag',
    mode_charge: 'Töltés',
    liters: 'Tankolt üzemanyag',
    energy: 'Töltött energia',
    total_cost: 'Teljes költség',
    odometer: 'Kilométeróra',
    optional: 'nem kötelező',
    save: 'Mentés',
    cancel: 'Mégse',
    save_error: 'Nem sikerült menteni: {e}',
    ed_entity: 'Jármű',
    ed_entity_helper: 'Automatikusan megtalálva; hagyd üresen az első jármű használatához',
    ed_title: 'Cím',
    ed_title_helper: 'Hagyd üresen a jármű nevéhez',
    ed_chart: 'Havi diagram',
    ed_chart_metric: 'A diagram mutatja',
    ed_months: 'Hónapok a diagramon',
    ed_trips: 'Legutóbbi utak',
    ed_refuels: 'Tankolások és töltések',
    ed_add_button: '„Tankolás vagy töltés rögzítése” gomb',
    ed_language: 'Nyelv',
    ed_language_helper: 'Hagyd üresen a Home Assistant követéséhez',
    card_name: 'Járműfogyasztás kártya',
    card_desc: 'Egy jármű üzemanyag- és energiafogyasztása: kijelzők, utak, havi diagram, tankolások és töltések',
    mini_name: 'Járműfogyasztás minikártya',
    mini_desc: 'Egy jármű kompakt nézete: tank és akkumulátor, utolsó út és átlagfogyasztás',
    zoom_in: 'Részletek megjelenítése',
    zoom_out: 'Vissza a kompakt nézethez',
    ed_zoom: 'Részletek gomb (teljes nézet)',
    estimated: 'Becsült',
  },
  sk: {
    title: 'Vozidlo',
    not_loaded: 'Nenastavené',
    not_loaded_hint: 'Vehicle Consumption nie je nastavené: pridajte vozidlo v Nastavenia → Zariadenia a služby',
    unavailable: 'Nedostupné',
    unavailable_hint: '{entity} je nedostupná: Vehicle Consumption sa možno spúšťa alebo znova načítava',
    not_found: 'Nenájdené',
    not_found_hint: '{entity} nie je senzor Vehicle Consumption alebo neexistuje: skontrolujte možnosti karty',
    driving: 'V jazde',
    fuel: 'Palivo',
    battery: 'Batéria',
    trip: 'Posledná jazda',
    trip_now: 'Aktuálna jazda',
    month: 'Tento mesiac',
    average: 'Priemer',
    cost_km: 'Náklady na {u}',
    month_cost: '{v} tento mesiac',
    recent_trips: 'Nedávne jazdy',
    refuels: 'Tankovania',
    charges: 'Nabíjania',
    no_trips: 'Zatiaľ žiadne jazdy',
    no_refuels: 'Zatiaľ žiadne tankovania',
    no_charges: 'Zatiaľ žiadne nabíjania',
    manual: 'Zadané ručne',
    charger: 'Domáca nabíjačka',
    chart_consumption: 'Spotreba',
    chart_distance: 'Vzdialenosť',
    chart_cost: 'Náklady',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Posledné mesiace: {n}',
    add: 'Zaznamenať tankovanie alebo nabíjanie',
    add_refuel: 'Zaznamenať tankovanie',
    add_charge: 'Zaznamenať nabíjanie',
    mode_refuel: 'Palivo',
    mode_charge: 'Nabíjanie',
    liters: 'Natankované palivo',
    energy: 'Dodaná energia',
    total_cost: 'Celková cena',
    odometer: 'Počítadlo kilometrov',
    optional: 'voliteľné',
    save: 'Uložiť',
    cancel: 'Zrušiť',
    save_error: 'Nepodarilo sa uložiť: {e}',
    ed_entity: 'Vozidlo',
    ed_entity_helper: 'Nájdené automaticky; nechajte prázdne, ak chcete použiť prvé vozidlo',
    ed_title: 'Názov',
    ed_title_helper: 'Nechajte prázdne pre názov vozidla',
    ed_chart: 'Mesačný graf',
    ed_chart_metric: 'Graf zobrazuje',
    ed_months: 'Mesiace v grafe',
    ed_trips: 'Nedávne jazdy',
    ed_refuels: 'Tankovania a nabíjania',
    ed_add_button: 'Tlačidlo „Zaznamenať tankovanie alebo nabíjanie“',
    ed_language: 'Jazyk',
    ed_language_helper: 'Nechajte prázdne, ak sa má použiť jazyk Home Assistant',
    card_name: 'Karta spotreby vozidla',
    card_desc: 'Spotreba paliva a energie vozidla: ukazovatele, jazdy, mesačný graf, tankovania a nabíjania',
    mini_name: 'Mini karta spotreby vozidla',
    mini_desc: 'Kompaktné zobrazenie vozidla: nádrž a batéria, posledná jazda a priemerná spotreba',
    zoom_in: 'Zobraziť podrobnosti',
    zoom_out: 'Späť na kompaktné zobrazenie',
    ed_zoom: 'Tlačidlo podrobností (úplné zobrazenie)',
    estimated: 'Odhad',
  },
  cs: {
    title: 'Vozidlo',
    not_loaded: 'Nenastaveno',
    not_loaded_hint: 'Vehicle Consumption není nastaveno: přidejte vozidlo v Nastavení → Zařízení a služby',
    unavailable: 'Nedostupné',
    unavailable_hint: '{entity} je nedostupná: Vehicle Consumption se možná spouští nebo znovu načítá',
    not_found: 'Nenalezeno',
    not_found_hint: '{entity} není senzor Vehicle Consumption nebo neexistuje: zkontrolujte možnosti karty',
    driving: 'V jízdě',
    fuel: 'Palivo',
    battery: 'Baterie',
    trip: 'Poslední jízda',
    trip_now: 'Aktuální jízda',
    month: 'Tento měsíc',
    average: 'Průměr',
    cost_km: 'Náklady na {u}',
    month_cost: '{v} tento měsíc',
    recent_trips: 'Nedávné jízdy',
    refuels: 'Tankování',
    charges: 'Nabíjení',
    no_trips: 'Zatím žádné jízdy',
    no_refuels: 'Zatím žádná tankování',
    no_charges: 'Zatím žádná nabíjení',
    manual: 'Zadáno ručně',
    charger: 'Domácí nabíječka',
    chart_consumption: 'Spotřeba',
    chart_distance: 'Vzdálenost',
    chart_cost: 'Náklady',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Poslední měsíce: {n}',
    add: 'Zaznamenat tankování nebo nabíjení',
    add_refuel: 'Zaznamenat tankování',
    add_charge: 'Zaznamenat nabíjení',
    mode_refuel: 'Palivo',
    mode_charge: 'Nabíjení',
    liters: 'Natankované palivo',
    energy: 'Dodaná energie',
    total_cost: 'Celková cena',
    odometer: 'Počítadlo kilometrů',
    optional: 'volitelné',
    save: 'Uložit',
    cancel: 'Zrušit',
    save_error: 'Nepodařilo se uložit: {e}',
    ed_entity: 'Vozidlo',
    ed_entity_helper: 'Nalezeno automaticky; ponechte prázdné, chcete-li použít první vozidlo',
    ed_title: 'Název',
    ed_title_helper: 'Ponechte prázdné pro název vozidla',
    ed_chart: 'Měsíční graf',
    ed_chart_metric: 'Graf zobrazuje',
    ed_months: 'Měsíce v grafu',
    ed_trips: 'Nedávné jízdy',
    ed_refuels: 'Tankování a nabíjení',
    ed_add_button: 'Tlačítko „Zaznamenat tankování nebo nabíjení“',
    ed_language: 'Jazyk',
    ed_language_helper: 'Ponechte prázdné, chcete-li použít jazyk Home Assistant',
    card_name: 'Karta spotřeby vozidla',
    card_desc: 'Spotřeba paliva a energie vozidla: ukazatele, jízdy, měsíční graf, tankování a nabíjení',
    mini_name: 'Mini karta spotřeby vozidla',
    mini_desc: 'Kompaktní zobrazení vozidla: nádrž a baterie, poslední jízda a průměrná spotřeba',
    zoom_in: 'Zobrazit podrobnosti',
    zoom_out: 'Zpět na kompaktní zobrazení',
    ed_zoom: 'Tlačítko podrobností (úplné zobrazení)',
    estimated: 'Odhad',
  },
  sl: {
    title: 'Vozilo',
    not_loaded: 'Ni nastavljeno',
    not_loaded_hint: 'Vehicle Consumption ni nastavljen: dodajte vozilo v Nastavitve → Naprave in storitve',
    unavailable: 'Ni na voljo',
    unavailable_hint: '{entity} ni na voljo: Vehicle Consumption se morda zaganja ali znova nalaga',
    not_found: 'Ni najdeno',
    not_found_hint: '{entity} ni senzor Vehicle Consumption ali ne obstaja: preverite možnosti kartice',
    driving: 'V vožnji',
    fuel: 'Gorivo',
    battery: 'Baterija',
    trip: 'Zadnja vožnja',
    trip_now: 'Trenutna vožnja',
    month: 'Ta mesec',
    average: 'Povprečje',
    cost_km: 'Strošek na {u}',
    month_cost: '{v} ta mesec',
    recent_trips: 'Nedavne vožnje',
    refuels: 'Točenja goriva',
    charges: 'Polnjenja',
    no_trips: 'Še ni voženj',
    no_refuels: 'Še ni točenj goriva',
    no_charges: 'Še ni polnjenj',
    manual: 'Vneseno ročno',
    charger: 'Domača polnilnica',
    chart_consumption: 'Poraba',
    chart_distance: 'Razdalja',
    chart_cost: 'Stroški',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Zadnji meseci: {n}',
    add: 'Zabeleži točenje goriva ali polnjenje',
    add_refuel: 'Zabeleži točenje goriva',
    add_charge: 'Zabeleži polnjenje',
    mode_refuel: 'Gorivo',
    mode_charge: 'Polnjenje',
    liters: 'Natočeno gorivo',
    energy: 'Dodana energija',
    total_cost: 'Skupni strošek',
    odometer: 'Števec kilometrov',
    optional: 'neobvezno',
    save: 'Shrani',
    cancel: 'Prekliči',
    save_error: 'Shranjevanje ni uspelo: {e}',
    ed_entity: 'Vozilo',
    ed_entity_helper: 'Najdeno samodejno; pustite prazno, da se uporabi prvo vozilo',
    ed_title: 'Naslov',
    ed_title_helper: 'Pustite prazno za ime vozila',
    ed_chart: 'Mesečni graf',
    ed_chart_metric: 'Graf prikazuje',
    ed_months: 'Meseci v grafu',
    ed_trips: 'Nedavne vožnje',
    ed_refuels: 'Točenja goriva in polnjenja',
    ed_add_button: 'Gumb »Zabeleži točenje goriva ali polnjenje«',
    ed_language: 'Jezik',
    ed_language_helper: 'Pustite prazno, da se sledi Home Assistant',
    card_name: 'Kartica porabe vozila',
    card_desc: 'Poraba goriva in energije vozila: merilniki, vožnje, mesečni graf, točenja goriva in polnjenja',
    mini_name: 'Mini kartica porabe vozila',
    mini_desc: 'Strnjen prikaz vozila: rezervoar in baterija, zadnja vožnja in povprečna poraba',
    zoom_in: 'Pokaži podrobnosti',
    zoom_out: 'Nazaj na strnjen prikaz',
    ed_zoom: 'Gumb za podrobnosti (celoten prikaz)',
    estimated: 'Ocena',
  },
  lv: {
    title: 'Automašīna',
    not_loaded: 'Nav iestatīts',
    not_loaded_hint: 'Vehicle Consumption nav iestatīts: pievienojiet transportlīdzekli sadaļā Iestatījumi → Ierīces un pakalpojumi',
    unavailable: 'Nav pieejams',
    unavailable_hint: '{entity} nav pieejams: iespējams, Vehicle Consumption tiek startēts vai pārlādēts',
    not_found: 'Nav atrasts',
    not_found_hint: '{entity} nav Vehicle Consumption sensors vai neeksistē: pārbaudiet kartītes opcijas',
    driving: 'Brauc',
    fuel: 'Degviela',
    battery: 'Akumulators',
    trip: 'Pēd. brauciens',
    trip_now: 'Šis brauciens',
    month: 'Šis mēnesis',
    average: 'Vidēji',
    cost_km: 'Izmaksas par {u}',
    month_cost: '{v} šomēnes',
    recent_trips: 'Nesenie braucieni',
    refuels: 'Uzpildes',
    charges: 'Uzlādes',
    no_trips: 'Vēl nav braucienu',
    no_refuels: 'Vēl nav uzpilžu',
    no_charges: 'Vēl nav uzlāžu',
    manual: 'Manuāli',
    charger: 'Mājas uzlādes stacija',
    chart_consumption: 'Patēriņš',
    chart_distance: 'Attālums',
    chart_cost: 'Izmaksas',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Pēdējie {n} mēneši',
    add: 'Reģistrēt uzpildi vai uzlādi',
    add_refuel: 'Reģistrēt uzpildi',
    add_charge: 'Reģistrēt uzlādi',
    mode_refuel: 'Degviela',
    mode_charge: 'Uzlāde',
    liters: 'Uzpildītā degviela',
    energy: 'Uzlādētā enerģija',
    total_cost: 'Kopējās izmaksas',
    odometer: 'Odometrs',
    optional: 'neobligāti',
    save: 'Saglabāt',
    cancel: 'Atcelt',
    save_error: 'Neizdevās saglabāt: {e}',
    ed_entity: 'Transportlīdzeklis',
    ed_entity_helper: 'Atrasts automātiski; atstājiet tukšu, lai izmantotu pirmo transportlīdzekli',
    ed_title: 'Virsraksts',
    ed_title_helper: 'Atstājiet tukšu, lai izmantotu transportlīdzekļa nosaukumu',
    ed_chart: 'Mēneša diagramma',
    ed_chart_metric: 'Diagramma rāda',
    ed_months: 'Mēneši diagrammā',
    ed_trips: 'Nesenie braucieni',
    ed_refuels: 'Uzpildes un uzlādes',
    ed_add_button: 'Poga “Reģistrēt uzpildi vai uzlādi”',
    ed_language: 'Valoda',
    ed_language_helper: 'Atstājiet tukšu, lai sekotu Home Assistant',
    card_name: 'Transportlīdzekļa patēriņa kartīte',
    card_desc: 'Transportlīdzekļa degvielas un enerģijas patēriņš: rādītāji, braucieni, mēneša diagramma, uzpildes un uzlādes',
    mini_name: 'Transportlīdzekļa patēriņa mini kartīte',
    mini_desc: 'Transportlīdzekļa kompakts skats: tvertne un akumulators, pēdējais brauciens un vidējais patēriņš',
    zoom_in: 'Rādīt detaļas',
    zoom_out: 'Atpakaļ uz kompakto skatu',
    ed_zoom: 'Detaļu poga (pilns skats)',
    estimated: 'Aplēsts',
  },
  el: {
    title: 'Όχημα',
    not_loaded: 'Δεν έχει ρυθμιστεί',
    not_loaded_hint: 'Το Vehicle Consumption δεν έχει ρυθμιστεί: προσθέστε ένα όχημα στις Ρυθμίσεις → Συσκευές & υπηρεσίες',
    unavailable: 'Μη διαθέσιμο',
    unavailable_hint: 'Το {entity} δεν είναι διαθέσιμο: το Vehicle Consumption ίσως ξεκινά ή επαναφορτώνεται',
    not_found: 'Δεν βρέθηκε',
    not_found_hint: 'Το {entity} δεν είναι αισθητήρας Vehicle Consumption ή δεν υπάρχει: ελέγξτε τις επιλογές της κάρτας',
    driving: 'Σε κίνηση',
    fuel: 'Καύσιμο',
    battery: 'Μπαταρία',
    trip: 'Τελ. διαδρομή',
    trip_now: 'Τρέχ. διαδρομή',
    month: 'Αυτός ο μήνας',
    average: 'Μέσος όρος',
    cost_km: 'Κόστος ανά {u}',
    month_cost: '{v} τον μήνα',
    recent_trips: 'Διαδρομές',
    refuels: 'Ανεφοδιασμοί',
    charges: 'Φορτίσεις',
    no_trips: 'Καμία διαδρομή ακόμα',
    no_refuels: 'Κανένας ανεφοδιασμός ακόμα',
    no_charges: 'Καμία φόρτιση ακόμα',
    manual: 'Χειροκίνητα',
    charger: 'Οικιακός φορτιστής',
    chart_consumption: 'Κατανάλωση',
    chart_distance: 'Απόσταση',
    chart_cost: 'Κόστος',
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
    last_months: 'Τελευταίοι {n} μήνες',
    add: 'Καταγραφή ανεφοδιασμού ή φόρτισης',
    add_refuel: 'Καταγραφή ανεφοδιασμού',
    add_charge: 'Καταγραφή φόρτισης',
    mode_refuel: 'Καύσιμο',
    mode_charge: 'Φόρτιση',
    liters: 'Καύσιμο που προστέθηκε',
    energy: 'Ενέργεια που προστέθηκε',
    total_cost: 'Κόστος',
    odometer: 'Χιλιομετρητής',
    optional: 'προαιρετικό',
    save: 'Αποθήκευση',
    cancel: 'Ακύρωση',
    save_error: 'Δεν ήταν δυνατή η αποθήκευση: {e}',
    ed_entity: 'Όχημα',
    ed_entity_helper: 'Βρίσκεται αυτόματα· αφήστε κενό για να χρησιμοποιηθεί το πρώτο όχημα',
    ed_title: 'Τίτλος',
    ed_title_helper: 'Αφήστε κενό για το όνομα του οχήματος',
    ed_chart: 'Μηνιαίο γράφημα',
    ed_chart_metric: 'Το γράφημα δείχνει',
    ed_months: 'Μήνες στο γράφημα',
    ed_trips: 'Πρόσφατες διαδρομές',
    ed_refuels: 'Ανεφοδιασμοί και φορτίσεις',
    ed_add_button: 'Κουμπί «Καταγραφή ανεφοδιασμού ή φόρτισης»',
    ed_language: 'Γλώσσα',
    ed_language_helper: 'Αφήστε κενό για να ακολουθεί το Home Assistant',
    card_name: 'Κάρτα κατανάλωσης οχήματος',
    card_desc: 'Κατανάλωση καυσίμου και ενέργειας ενός οχήματος: δείκτες, διαδρομές, μηνιαίο γράφημα, ανεφοδιασμοί και φορτίσεις',
    mini_name: 'Μίνι κάρτα κατανάλωσης οχήματος',
    mini_desc: 'Συμπαγής προβολή ενός οχήματος: ρεζερβουάρ και μπαταρία, τελευταία διαδρομή και μέση κατανάλωση',
    zoom_in: 'Εμφάνιση λεπτομερειών',
    zoom_out: 'Επιστροφή στη συμπαγή προβολή',
    ed_zoom: 'Κουμπί λεπτομερειών (πλήρης προβολή)',
    estimated: 'Εκτίμηση',
  },
  sr: {
    title: 'Возило',
    not_loaded: 'Није подешено',
    not_loaded_hint: 'Vehicle Consumption није подешен: додајте возило у Подешавања → Уређаји и услуге',
    unavailable: 'Недоступно',
    unavailable_hint: 'Ентитет {entity} није доступан: Vehicle Consumption се можда покреће или поново учитава',
    not_found: 'Није пронађено',
    not_found_hint: 'Ентитет {entity} није сензор Vehicle Consumption или не постоји: проверите опције картице',
    driving: 'У вожњи',
    fuel: 'Гориво',
    battery: 'Батерија',
    trip: 'Последња вожња',
    trip_now: 'Тренутна вожња',
    month: 'Овај месец',
    average: 'Просек',
    cost_km: 'Трошак по {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Картица потрошње возила',
    card_desc: 'Потрошња горива и енергије возила: показивачи, вожње, месечни графикон, точења горива и пуњења',
    mini_name: 'Мини картица потрошње возила',
    mini_desc: 'Компактан приказ возила: резервоар и батерија, последња вожња и просечна потрошња',
    zoom_in: 'Прикажи детаље',
    zoom_out: 'Назад на компактан приказ',
    ed_zoom: 'Дугме за детаље (пун приказ)',
    estimated: 'Процена',
  },
  'sr-Latn': {
    title: 'Vozilo',
    not_loaded: 'Nije podešeno',
    not_loaded_hint: 'Vehicle Consumption nije podešen: dodajte vozilo u Podešavanja → Uređaji i usluge',
    unavailable: 'Nedostupno',
    unavailable_hint: 'Entitet {entity} nije dostupan: Vehicle Consumption se možda pokreće ili ponovo učitava',
    not_found: 'Nije pronađeno',
    not_found_hint: 'Entitet {entity} nije senzor Vehicle Consumption ili ne postoji: proverite opcije kartice',
    driving: 'U vožnji',
    fuel: 'Gorivo',
    battery: 'Baterija',
    trip: 'Poslednja vožnja',
    trip_now: 'Trenutna vožnja',
    month: 'Ovaj mesec',
    average: 'Prosek',
    cost_km: 'Trošak po {u}',
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
    chart_co2: 'CO₂',
    co2_km: '{v} g CO₂/{u}',
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
    card_name: 'Kartica potrošnje vozila',
    card_desc: 'Potrošnja goriva i energije vozila: pokazivači, vožnje, mesečni grafikon, točenja goriva i punjenja',
    mini_name: 'Mini kartica potrošnje vozila',
    mini_desc: 'Kompaktan prikaz vozila: rezervoar i baterija, poslednja vožnja i prosečna potrošnja',
    zoom_in: 'Prikaži detalje',
    zoom_out: 'Nazad na kompaktan prikaz',
    ed_zoom: 'Dugme za detalje (pun prikaz)',
    estimated: 'Procena',
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
  // Mini card: the detail button (top right) that opens the full view.
  zoom: true,
};
const VC_METRICS = ['consumption', 'distance', 'cost', 'co2'];
// Rows listed in a folded section, newest first.
const VC_ROWS = 5;
// A gauge under this level turns to the warning colour.
const VC_LOW = 15;
// First-render animations (gauge fill, chart bars) last this long: a re-render inside that window resumes them.
const VC_ANIM_MS = 1600;
const VC_DASH = '—';

const vcFinite = (v) => v != null && v !== '' && Number.isFinite(Number(v));

// The units of the figures the integration gives (its `units` option): metric, or imperial (miles, US gallons, mpg,
// mi/kWh, cost and CO₂ per mile). The source odometer's unit (`odometer_unit`): what an odometer entered by hand is in.
const VC_KM = { km: 1, mi: 1.609344, m: 0.001 };
const VC_GALLON = 3.785411784;
function vcUnits(a) {
  const imperial = a?.units === 'imperial';
  const dist = imperial ? 'mi' : 'km';
  const source = a?.odometer_unit in VC_KM ? a.odometer_unit : dist;
  return {
    imperial,
    dist,
    vol: imperial ? 'gal' : 'L',
    fuel: imperial ? 'mpg' : 'L/100 km',
    energy: imperial ? 'mi/kWh' : 'kWh/100 km',
    odometer: source,
    // An odometer shown (in `dist`) to the odometer sensor's unit, and litres from what is typed (gal or L).
    toSource: (v) => (v * VC_KM[dist]) / VC_KM[source],
    toLiters: (v) => (imperial ? v * VC_GALLON : v),
  };
}

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
  // narrowSymbol: Romanian, Hungarian and Ukrainian would otherwise print "0,107 EUR", too wide for the cost tile.
  const money = (v, digits = 2) => {
    if (!vcFinite(v)) return VC_DASH;
    if (!cur) return num(v, digits);
    return nf({ style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v));
  };
  const symbol = () => (cur ? nf({ style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value || cur : '');
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
  // Home Assistant's 12 / 24 h setting ('language' and 'system' leave it to the locale).
  const hour12 = loc.time_format === '12' ? true : loc.time_format === '24' ? false : undefined;
  const timeFmt = new Intl.DateTimeFormat(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(hour12 === undefined ? {} : { hourCycle: hour12 ? 'h12' : 'h23' }),
  });
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

// No vehicle with its history (Home Assistant starting, the integration reloading): the main sensor that is down,
// by its translation key, else any sensor of the integration when they are all down; undefined when none is.
const vcDown = (hass) => {
  const ids = vcCandidates(hass?.entities);
  const down = (id) => ['unavailable', 'unknown', undefined].includes(hass?.states?.[id]?.state);
  const main = ids.filter((id) => hass.entities[id]?.translation_key === 'consumption' && down(id)).sort()[0];
  return main || (ids.length && ids.every(down) ? [...ids].sort()[0] : undefined);
};

// Which energies the vehicle tracks.
const vcTracks = (kind) => ({ fuel: kind !== 'electric', energy: kind === 'electric' || kind === 'plugin_hybrid' });

// A decimal typed with a comma or a dot, or null.
const vcParse = (s) => {
  const v = Number(String(s ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return String(s ?? '').trim() !== '' && Number.isFinite(v) ? v : null;
};

// A click inside a dialog opened from the card (more-info, a picker) is not a click outside it.
const vcInDialog = (ev) => ev.composedPath().some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n?.localName));

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
      else if (ev.key === 'Tab' && this._popup) this._trapTab(ev);
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
    // The chart is drawn at the card's width (its labels keep their size); a few pixels do not re-render.
    if (typeof ResizeObserver === 'function') {
      this._ro ??= new ResizeObserver((entries) => {
        const width = Math.round(entries[entries.length - 1]?.contentRect?.width || 0);
        // The last width seen: a frame already asked for renders at it, or not at all if it came back.
        if (width > 0) this._nextWidth = width;
        if (width > 0 && Math.abs(width - (this._width || 0)) >= 8) {
          // Re-rendered at the next frame, not in this callback: a re-render there resizes what is observed in the
          // same frame ("ResizeObserver loop completed with undelivered notifications", at every load). Several
          // resizes in one frame: one render, at the last width, and none if it came back to the rendered one.
          this._frame ||= requestAnimationFrame(() => {
            this._frame = 0;
            if (Math.abs(this._nextWidth - (this._width || 0)) < 8) return;
            this._width = this._nextWidth;
            this._render();
          });
        } else {
          // A few pixels: no re-render, but the pill's label may now fit, or no longer.
          this._fitPill();
        }
      });
      this._ro.observe(this);
    }
  }

  disconnectedCallback() {
    this._ro?.disconnect();
    if (this._frame) cancelAnimationFrame(this._frame);
    this._frame = 0;
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onKey);
  }

  getCardSize() {
    const c = this._config || {};
    return 4 + (c.chart !== false ? 3 : 0) + (c.trips !== false ? 1 : 0) + (c.refuels !== false ? 1 : 0);
  }

  getGridOptions() {
    // 8 of 12 columns: about 208 px in a phone's section, the narrowest where the figures and the pill still fit (at
    // 6, about 156 px, the consumption values are cut and the pill leaves the card while driving).
    return { columns: 12, min_columns: 8, rows: 'auto' };
  }

  // Compact view (the mini card until its detail button is pressed): header, gauges, last trip and average.
  _compact() {
    return false;
  }

  // The mini card's detail button: none on the full card.
  _zoomButton() {
    return '';
  }

  _zoomClick() {}

  _t(key, vars) {
    return vcT(vcLang(this._hass, this._config), key, vars);
  }

  // The main sensor: the configured one, else the first vehicle found (by name), else one that is down (so the card
  // says it is unavailable, not that nothing is set up). The registry scan is kept until
  // hass.entities changes; the states are read again each time.
  _lookup() {
    return this._config.entity || vcPick(this._hass) || vcDown(this._hass);
  }

  _render(force = false) {
    if (!this._config || !this._hass || !this.shadowRoot) return;
    const c = this._config;
    const entity = this._lookup();
    const st = entity ? this._hass.states[entity] : undefined;
    const a = Array.isArray(st?.attributes?.months) ? st.attributes : null;
    const lang = vcLang(this._hass, c);
    const compact = this._compact();
    const sig = JSON.stringify([c, lang, this._hass.locale, entity, st?.state, a, [...this._open], this._popup?.mode, !!this._popup, this._width, compact]);
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
      // No vehicle found at all: not set up. A configured sensor: unavailable (starting, reloading) or not found
      // (a typo, another sensor, a vehicle removed).
      const why = !entity ? 'not_loaded' : st && ['unavailable', 'unknown'].includes(st.state) ? 'unavailable' : 'not_found';
      this.shadowRoot.innerHTML = `
      <style>${VehicleConsumptionCard.styles}</style>
      <ha-card class="lvl-na${this.hasAttribute?.('mini') ? ' mini' : ''}">
        <div class="head">
          <div class="badge"><ha-icon icon="${VC_ICON}"></ha-icon></div>
          <div class="title"><span class="tname">${vcEsc(c.title || this._t('title'))}</span></div>
          ${this._pill(this._t(why))}
        </div>
        <div class="empty">${vcEsc(this._t(`${why}_hint`, { entity }))}</div>
      </ha-card>`;
      this._fitPill();
      return;
    }

    const f = vcFormat(this._hass, lang, a.currency);
    const kind = VC_KINDS.includes(a.kind) ? a.kind : 'fuel';
    const tracks = vcTracks(kind);
    const gauges = [
      tracks.fuel ? this._gauge('fuel', a.fuel_level, a.fuel_quantity, vcUnits(a).vol, 'mdi:gas-station', f) : null,
      tracks.energy ? this._gauge('battery', a.battery_level, a.battery_energy, 'kWh', 'mdi:battery-charging-medium', f) : null,
    ].filter(Boolean);
    const low = gauges.some((g) => g.low);
    const level = a.driving ? 'drive' : low ? 'warn' : 'ok';
    // The sensor keeps its metric unit (statistics): with imperial units, its figure in mpg / mi/kWh is an attribute.
    const imperial = 'imperial_value' in a;
    const value = imperial ? a.imperial_value : st.state;
    const unit = (imperial && a.imperial_unit) || st.attributes.unit_of_measurement || (tracks.fuel ? vcUnits(a).fuel : vcUnits(a).energy);
    const avg = vcFinite(value) ? `${f.num(value, 1)} ${unit}` : VC_DASH;

    // First-render animations: started at the first render, resumed (negative delay) by a re-render inside the window.
    this._born ??= Date.now();
    const elapsed = Date.now() - this._born;
    const anim = elapsed < VC_ANIM_MS ? ` anim" style="--vc-t:${-elapsed}ms` : '';

    const add =
      !compact && c.add_button !== false && a.entry_id
        ? `<button class="icon-btn add" title="${vcEsc(this._t('add'))}" aria-label="${vcEsc(this._t('add'))}"><ha-icon icon="mdi:plus"></ha-icon></button>`
        : '';
    const driving = a.driving
      ? `<span class="drive" title="${vcEsc(this._t('driving'))}" aria-label="${vcEsc(this._t('driving'))}"></span>`
      : '';

    this.shadowRoot.innerHTML = `
      <style>${VehicleConsumptionCard.styles}</style>
      <ha-card class="lvl-${level}${this.hasAttribute?.('mini') ? ' mini' : ''}${this._popup ? ' has-popup' : ''}${anim}">
        <div class="head">
          <div class="badge"><ha-icon icon="${VC_ICON}"></ha-icon></div>
          <div class="title"><span class="tname">${vcEsc(c.title || a.vehicle || this._t('title'))}</span>${driving}</div>
          ${add}
          ${this._pill(avg)}
          ${this._zoomButton()}
        </div>
        <div class="gauges">${gauges.map((g) => g.html).join('')}</div>
        <div class="kpis">${this._kpis(a, kind, f, compact)}</div>
        ${!compact && c.chart !== false ? this._chart(a, kind, f) : ''}
        ${compact ? '' : this._sections(a, kind, f)}
        ${this._popup && !compact ? this._popupHtml(a, kind, f) : ''}
      </ha-card>`;

    this._bind();
    this._fitPill();
  }

  // The header pill: its text, or only its coloured dot on a narrow card (the text stays in the tooltip and label).
  _pill(text) {
    const t = vcEsc(text);
    return `<div class="pill" title="${t}" aria-label="${t}"><span class="pdot"></span><span class="ptxt">${t}</span></div>`;
  }

  // The whole label while it fits: the title (flex basis 0) gives its room down to 4 characters before the pill
  // shrinks, so a cut label means the room is really missing; then tighter header gaps, then only the dot. Each
  // step is measured, so a wider card never shows less (a dot) than a narrower one. Not laid out: the label.
  _fitPill() {
    const pill = this.shadowRoot?.querySelector('.pill');
    if (!pill?.classList) return;
    const cut = () => pill.scrollWidth > pill.clientWidth;
    pill.classList.remove('tight', 'dot');
    if (!cut()) return;
    pill.classList.add('tight');
    if (cut()) pill.classList.add('dot');
  }

  _bind() {
    const root = this.shadowRoot;
    root.querySelector('.add')?.addEventListener('click', () => this._openPopup());
    root.querySelector('.zoom')?.addEventListener('click', (ev) => this._zoomClick(ev));
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
    // The amount, ready to type in, without scrolling the dashboard to the card (a re-render: mode, error); the
    // opening brings the popup into view itself (`_openPopup`).
    root.querySelector('input[name="amount"]')?.focus?.({ preventScroll: true });
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
    const u = vcUnits(this._attrs);
    return [
      t.fuel ? { v: f.num(obj?.fuel_consumption, 1), unit: u.fuel } : null,
      t.energy ? { v: f.num(obj?.energy_consumption, 1), unit: u.energy } : null,
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

  // The compact view keeps the last trip and the average.
  _kpis(a, kind, f, compact = false) {
    const u = vcUnits(a);
    const km = (v) => (vcFinite(v) ? `${f.num(v, Number(v) < 100 ? 1 : 0)} ${u.dist}` : '');
    const trip = a.trip || {};
    const tripSub = [km(trip.distance), vcFinite(trip.cost) ? f.money(trip.cost) : ''].filter(Boolean).join(' · ');
    const month = a.month || {};
    const total = a.total || {};
    const cpk = vcFinite(total.cost_per_km) ? total.cost_per_km : month.cost_per_km;
    const tripKpi = this._kpi('k-trip', this._t(a.driving ? 'trip_now' : 'trip'), 'mdi:map-marker-distance', this._cons(trip, kind, f), tripSub);
    const avgKpi = this._kpi('k-avg', this._t('average'), 'mdi:chart-line', this._cons(total, kind, f), km(total.distance));
    if (compact) return tripKpi + avgKpi;
    return [
      tripKpi,
      this._kpi('k-month', this._t('month'), 'mdi:calendar-month-outline', this._cons(month, kind, f), km(month.distance)),
      avgKpi,
      this._kpi(
        'k-cost',
        this._t('cost_km', { u: u.dist }),
        'mdi:cash',
        [{ v: f.money(cpk, 3), unit: vcFinite(cpk) ? `/${u.dist}` : '' }],
        // The month's cost, and the CO₂ per km of the whole period when the integration gives it.
        [
          vcFinite(month.cost) ? this._t('month_cost', { v: f.money(month.cost) }) : '',
          vcFinite(total.co2_per_km) ? this._t('co2_km', { v: f.num(total.co2_per_km, 0), u: u.dist }) : '',
        ]
          .filter(Boolean)
          .join(' · '),
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
    const metricOf = (m) =>
      metric === 'distance' ? m?.distance : metric === 'cost' ? m?.cost : metric === 'co2' ? m?.co2 : m?.[`${primary}_consumption`];
    const values = keys.map((k) => (vcFinite(metricOf(byKey.get(k))) ? Number(metricOf(byKey.get(k))) : null));
    const max = Math.max(0, ...values.filter((v) => v != null));
    const u = vcUnits(a);
    const unit =
      metric === 'distance' ? u.dist : metric === 'cost' ? a.currency || '' : metric === 'co2' ? 'kg CO₂' : u[primary];
    const label = (v) =>
      metric === 'cost' ? f.money(v, 0) : metric === 'distance' || metric === 'co2' ? f.num(v, 0) : f.num(v, 1);
    // The card's width less its padding (12 px) and the chart's (10 px), so 1 unit is 1 px; 400 until measured.
    const W = this._width ? Math.max(160, Math.min(1200, this._width - 44)) : 400;
    const top = 16;
    const plot = 78;
    const base = top + plot;
    const H = base + 18;
    const slot = W / n;
    const bw = Math.min(30, slot * 0.58);
    // Narrow slots: every other month name (the current one kept). Every bar has its value as long as the longest one
    // fits its slot (about 0.6 em a character, tabular figures), down to 8 px; narrower, the current month's only.
    const named = (i) => slot >= 24 || (n - 1 - i) % 2 === 0;
    const longest = Math.max(1, ...values.map((v) => (v != null && v > 0 ? label(v).length : 0)));
    const fs = Math.min(9.5, (slot - 2) / (longest * 0.6));
    const valued = (i) => fs >= 8 || i === n - 1;
    const vstyle = fs >= 8 && fs < 9.5 ? ` style="font-size:${fs.toFixed(1)}px"` : '';
    const bars = keys
      .map((k, i) => {
        const v = values[i];
        const x = i * slot + (slot - bw) / 2;
        const cx = (i * slot + slot / 2).toFixed(1);
        const now = i === n - 1;
        const name = f.month(k);
        if (v == null || v <= 0 || max <= 0) {
          return `<g class="col"><rect class="bar stub" x="${x.toFixed(1)}" y="${base - 3}" width="${bw.toFixed(1)}" height="3" rx="1.5"><title>${vcEsc(`${name}: ${VC_DASH}`)}</title></rect>
            ${named(i) ? `<text class="ml${now ? ' now' : ''}" x="${cx}" y="${H - 4}">${vcEsc(name)}</text>` : ''}</g>`;
        }
        const h = Math.max(4, (v / max) * plot);
        return `<g class="col"><rect class="bar${now ? ' now' : ''}" style="--i:${i}" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4"><title>${vcEsc(`${name}: ${label(v)} ${metric === 'cost' ? '' : unit}`.trim())}</title></rect>
            ${valued(i) ? `<text class="bv${now ? ' now' : ''}"${vstyle} x="${cx}" y="${(base - h - 4).toFixed(1)}">${vcEsc(label(v))}</text>` : ''}
            ${named(i) ? `<text class="ml${now ? ' now' : ''}" x="${cx}" y="${H - 4}">${vcEsc(name)}</text>` : ''}</g>`;
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
    const u = vcUnits(a);
    const out = [];
    if (c.trips !== false) {
      // The trip being driven first: it only joins the list once `trip_gap` has passed without a move.
      const open = a.driving && a.trip && vcFinite(a.trip.distance) && a.trip.distance > 0 ? [{ ...a.trip, open: true }] : [];
      const all = [...open, ...(Array.isArray(a.trips) ? a.trips : [])];
      const rows = all.slice(0, VC_ROWS).map((t) => {
        // A plug-in hybrid has two: one a line, so the column stays narrow.
        const cons = this._cons(t, kind, f)
          .filter((l) => l.v !== VC_DASH)
          .map((l) => `${l.v} ${l.unit}`);
        // A trip whose use a coarse sensor (whole litres) could not measure: estimated by the integration, marked so.
        const sub = [
          vcFinite(t.distance) ? `${f.num(t.distance, 1)} ${u.dist}` : '',
          t.open ? this._t('driving') : '',
          t.estimated ? `≈ ${this._t('estimated')}` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return this._row(f.date(t.start), sub || VC_DASH, cons.length ? cons : VC_DASH, f.money(t.cost));
      });
      // The count of everything kept (a year): the list only holds the newest.
      const count = open.length + (vcFinite(a.trip_count) ? a.trip_count : all.length - open.length);
      out.push(this._section('trips', 'mdi:map-marker-path', this._t('recent_trips'), count, rows, 'no_trips'));
    }
    if (c.refuels !== false) {
      const t = vcTracks(kind);
      const events = (list, key, unit) =>
        (Array.isArray(list) ? list : []).slice(0, VC_ROWS).map((e) => {
          const from = e.source === 'manual' || e.source === 'charger' ? this._t(e.source) : '';
          const sub = [vcFinite(e.odometer) ? `${f.num(e.odometer, 0)} ${u.dist}` : '', from]
            .filter(Boolean)
            .join(' · ');
          return this._row(f.date(e.time), sub || VC_DASH, vcFinite(e[key]) ? `${f.num(e[key], 1)} ${unit}` : VC_DASH, f.money(e.cost), e.source === 'manual');
        });
      if (t.fuel) out.push(this._section('refuels', 'mdi:gas-station', this._t('refuels'), vcFinite(a.refuel_count) ? a.refuel_count : a.refuels?.length || 0, events(a.refuels, 'liters', u.vol), 'no_refuels'));
      if (t.energy) out.push(this._section('charges', 'mdi:ev-station', this._t('charges'), vcFinite(a.charge_count) ? a.charge_count : a.charges?.length || 0, events(a.charges, 'energy', 'kWh'), 'no_charges'));
    }
    return out.length ? `<div class="sections">${out.join('')}</div>` : '';
  }

  // `value`: a text, or several (one a line).
  _row(main, sub, value, cost, manual = false) {
    const values = (Array.isArray(value) ? value : [value]).map((v) => `<span class="v">${vcEsc(v)}</span>`).join('');
    return `
              <div class="row${manual ? ' manual' : ''}">
                <span class="txt"><span class="name">${vcEsc(main)}</span><span class="sub">${vcEsc(sub)}</span></span>
                <span class="val">${values}<span class="sub">${vcEsc(cost)}</span></span>
              </div>`;
  }

  // A collapsible section: chevron right when folded, down when open.
  _section(key, icon, label, count, rows, emptyKey) {
    const open = this._open.has(key);
    // Only the last rows are listed: "5/6" when there are more.
    const shown = count > rows.length && rows.length ? `${rows.length}/${count}` : String(count);
    return `
          <section class="section${open ? ' open' : ''}" data-section="${key}">
            <button class="fold" data-key="${key}" aria-expanded="${open}">
              <ha-icon class="chev" icon="mdi:chevron-right"></ha-icon>
              <ha-icon class="sic" icon="${icon}"></ha-icon>
              <span class="slabel">${vcEsc(label)}</span>
              <span class="count">${shown}</span>
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
    // The focus goes back to the add button once the popup closes.
    this._refocus = true;
    document.addEventListener('keydown', this._onKey);
    this._render(true);
    // Opened from the keyboard with the card scrolled out of view: the popup is brought into view (as little as
    // needed). Only here: the focus given back after a re-render (`_bind`) never scrolls the dashboard.
    this.shadowRoot?.querySelector?.('.sheet')?.scrollIntoView?.({ block: 'nearest' });
  }

  _closePopup() {
    if (!this._popup) return;
    this._popup = null;
    document.removeEventListener('keydown', this._onKey);
    this._render(true);
    if (this._refocus) this.shadowRoot?.querySelector?.('.add')?.focus?.({ preventScroll: true });
    this._refocus = false;
  }

  // A modal popup: Tab and Shift+Tab go round its fields and buttons, never out to the card or the dashboard.
  _trapTab(ev) {
    const root = this.shadowRoot;
    const items = [...(root?.querySelector?.('.sheet')?.querySelectorAll?.('button:not([disabled]), input') || [])];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = items.includes(root.activeElement);
    if (ev.shiftKey && (!inside || root.activeElement === first)) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && (!inside || root.activeElement === last)) {
      ev.preventDefault();
      first.focus();
    }
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
    const u = vcUnits(this._attrs);
    // The service takes litres, and an odometer in the unit of the odometer sensor (typed here in that unit).
    const data = { config_entry_id: this._attrs.entry_id, [charge ? 'energy' : 'liters']: charge ? amount : u.toLiters(amount) };
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
    const u = vcUnits(a);
    const field = (name, label, unit, placeholder = '', optional = false) => `
            <label class="field">
              <span class="flabel">${vcEsc(label)}${optional ? ` <i>${vcEsc(this._t('optional'))}</i>` : ''}</span>
              <span class="fbox"><input name="${name}" inputmode="decimal" autocomplete="off" value="${vcEsc(p.values[name] ?? '')}" placeholder="${vcEsc(placeholder)}"><em>${vcEsc(unit)}</em></span>
            </label>`;
    const tab = (mode, icon) =>
      `<button class="tab${p.mode === mode ? ' on' : ''}" data-mode="${mode}" aria-pressed="${p.mode === mode}"><ha-icon icon="${icon}"></ha-icon>${vcEsc(this._t(`mode_${mode}`))}</button>`;
    return `
        <div class="veil" data-act="cancel"></div>
        <div class="sheet" role="dialog" aria-modal="true" aria-label="${vcEsc(title)}">
          <div class="shead">
            <span class="ic"><ha-icon icon="${charge ? 'mdi:ev-station' : 'mdi:gas-station'}"></ha-icon></span>
            <span class="stitle">${vcEsc(title)}</span>
            <button class="icon-btn" data-act="cancel" title="${vcEsc(this._t('cancel'))}" aria-label="${vcEsc(this._t('cancel'))}"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
          ${kind === 'plugin_hybrid' ? `<div class="tabs" role="group">${tab('refuel', 'mdi:gas-station')}${tab('charge', 'mdi:ev-station')}</div>` : ''}
          <div class="fields">
            ${field('amount', this._t(charge ? 'energy' : 'liters'), charge ? 'kWh' : u.vol)}
            ${field('cost', this._t('total_cost'), f.symbol() || a.currency || '', '', true)}
            ${field('odometer', this._t('odometer'), u.odometer, vcFinite(a.odometer) ? f.num(u.toSource(Number(a.odometer)), 0) : '', true)}
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
      /* min-width: 0 lets a 1fr grid track shrink the card below its intrinsic width (no overflow). */
      :host {
        display: block;
        min-width: 0;
        --vc-ok: var(--primary-color, #03a9f4);
        --vc-drive: var(--success-color, #43a047);
        --vc-warn: var(--warning-color, #ffa600);
        --vc-na: var(--disabled-color, #9e9e9e);
        --vc-fuel: var(--vc-fuel-color, #f59e0b);
        --vc-battery: var(--vc-battery-color, #22c55e);
      }
      /* The inline-size container (ha-card) has no content width: in a parent sized by its content (inline-block, an
         "auto" grid column) it would fall to its padding. This empty row gives the card a 300px max-content width but a
         0 min-content one, so a 1fr grid track still shrinks it, even through a wrapper (a div, hui-card) that keeps
         min-width: auto. (An intrinsic-size containment would be a min-content width there: the card would overflow.) */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 300px); height: 0; }
      :host([mini])::before { grid-template-columns: minmax(0, 240px); }
      ha-card { position: relative; padding: 12px; overflow: hidden; container-type: inline-size;
                --ci: color-mix(in srgb, var(--c) 40%, var(--primary-text-color)); }
      ha-card.lvl-ok    { --c: var(--vc-ok); }
      ha-card.lvl-drive { --c: var(--vc-drive); }
      ha-card.lvl-warn  { --c: var(--vc-warn); }
      ha-card.lvl-na    { --c: var(--vc-na); }
      ha-card.has-popup { min-height: 360px; }

      .head { display: flex; align-items: center; gap: 10px; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      .title { flex: 1 1 0; min-width: 4ch; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 500;
               color: var(--primary-text-color); white-space: nowrap; }
      .title:has(.drive) { min-width: calc(4ch + 18px); }
      .tname { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .pill { flex: 0 1 auto; min-width: 0; max-width: 50%; overflow: hidden; text-overflow: ellipsis; font-size: 11px; font-weight: 500; padding: 1px 8px; border-radius: 999px; white-space: nowrap;
              color: var(--ci); background: color-mix(in srgb, var(--c) 14%, transparent); font-variant-numeric: tabular-nums; }
      .pdot { display: none; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
      /* Tighter header gaps once the whole label no longer fits with the normal ones (measured by _fitPill, not a
         container width: a fixed width let a label that fitted tight just under it turn into a dot just over it). */
      .head:has(.pill.tight), .head:has(.pill.tight) .title { gap: 6px; }
      .pill.tight { padding: 1px 6px; }
      /* Only the coloured dot (the text stays in title / aria-label) once the whole label no longer fits next to a
         4-character title: measured on the label itself at each render and resize (_fitPill), so a longer label
         (kWh/100 km, a translation) or a driving title turns into a dot only when the room is really missing. */
      .pill.dot { padding: 5px; }
      .pill.dot .ptxt { display: none; }
      .pill.dot .pdot { display: block; }
      .icon-btn { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
                  display: grid; place-items: center; color: var(--secondary-text-color); }
      .icon-btn:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .icon-btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .icon-btn ha-icon { --mdc-icon-size: 18px; }
      /* The mini card's detail button, at the top right of the header. */
      .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: -4px -4px 0 0; border-radius: 50%; align-self: flex-start;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
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
      .gauge.low .gval { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
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
      /* Narrow card (6 columns of a section): the unit under the value, long labels on two lines. */
      @container (max-width: 250px) {
        .kv small { display: block; margin-left: 0; }
        .kl, .ks { white-space: normal; overflow-wrap: anywhere; }
        .kl { align-items: flex-start; }
      }

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
      .chart text.now { fill: color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); font-weight: 600; }

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
      .val { flex: 0 1 auto; min-width: 0; max-width: 60%; align-items: flex-end; }
      .name, .v { font-size: 13px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color); white-space: nowrap;
                  overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
      .sub { font-size: 11px; line-height: 1.25; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden;
             text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
      .row.manual .txt .sub { color: color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); }
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
      .tab.on { background: color-mix(in srgb, var(--primary-color) 15%, transparent); color: color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); }
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
      .btn.accent { color: color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); border-color: color-mix(in srgb, var(--primary-color) 60%, transparent); }
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

/**
 * Compact card: header (badge, name, average), the gauges, the last trip and the average. Its detail button (top
 * right, `zoom: false` removes it) switches it to the full card and back; a click outside the card brings the compact
 * view back.
 */
class VehicleConsumptionMiniCard extends VehicleConsumptionCard {
  static getConfigElement() {
    return document.createElement('vehicle-consumption-mini-card-editor');
  }

  constructor() {
    super();
    this._zoomed = false;
    this._onOutside = (ev) => {
      if (this._zoomed && !ev.composedPath().includes(this) && !vcInDialog(ev)) this._setZoom(false);
    };
  }

  setConfig(config) {
    // The host attribute behind the mini card's styles; never set in the constructor.
    this.setAttribute?.('mini', '');
    super.setConfig(config);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._onOutside, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onOutside, true);
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : 3;
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6, rows: 'auto' };
  }

  _compact() {
    return !this._zoomed;
  }

  _zoomButton() {
    if (this._config?.zoom === false) return '';
    const label = vcEsc(this._t(this._zoomed ? 'zoom_out' : 'zoom_in'));
    return `<button class="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}"><ha-icon icon="mdi:${this._zoomed ? 'arrow-collapse' : 'arrow-expand'}"></ha-icon></button>`;
  }

  _zoomClick(ev) {
    ev?.stopPropagation?.();
    this._setZoom(!this._zoomed);
    // Keyboard use (Enter / Space: no click count) keeps the focus on the button, without scrolling the page.
    if (!ev?.detail) this.shadowRoot?.querySelector?.('.zoom')?.focus?.({ preventScroll: true });
  }

  _setZoom(zoomed) {
    this._zoomed = zoomed;
    // The popup is only on the full view: folding drops it.
    if (!zoomed && this._popup) {
      this._popup = null;
      this._refocus = false;
      document.removeEventListener('keydown', this._onKey);
    }
    this._render(true);
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
      // What the chart shows only matters with the chart.
      ...(c.chart === false
        ? []
        : [
            {
              name: 'chart_metric',
              selector: {
                select: { mode: 'dropdown', options: VC_METRICS.map((m) => ({ value: m, label: vcT(lang, `chart_${m}`) })) },
              },
            },
            { name: 'months', selector: { number: { min: 3, max: 12, mode: 'slider' } } },
          ]),
      { name: 'trips', selector: { boolean: {} } },
      { name: 'refuels', selector: { boolean: {} } },
      { name: 'add_button', selector: { boolean: {} } },
      ...(this.constructor.mini ? [{ name: 'zoom', selector: { boolean: {} } }] : []),
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
              { value: 'ro', label: 'Română' },
              { value: 'da', label: 'Dansk' },
              { value: 'sv', label: 'Svenska' },
              { value: 'bg', label: 'Български' },
              { value: 'ru', label: 'Русский' },
              { value: 'uk', label: 'Українська' },
              { value: 'hu', label: 'Magyar' },
              { value: 'sk', label: 'Slovenčina' },
              { value: 'cs', label: 'Čeština' },
              { value: 'sl', label: 'Slovenščina' },
              { value: 'lv', label: 'Latviešu' },
              { value: 'el', label: 'Ελληνικά' },
              { value: 'sr', label: 'Српски' },
              { value: 'sr-Latn', label: 'Srpski (latinica)' },
            ],
          },
        },
      },
    ];
  }
}

class VehicleConsumptionMiniCardEditor extends VehicleConsumptionCardEditor {
  static get mini() {
    return true;
  }
}

// The card picker's language: Home Assistant's (its element, else the language it keeps), else the browser's.
function vcPickerLang() {
  let stored = null;
  try {
    stored = JSON.parse(window.localStorage?.getItem('selectedLanguage') || 'null');
  } catch {
    stored = null;
  }
  const hass = document.querySelector?.('home-assistant')?.hass;
  return vcLang({ language: hass?.locale?.language || hass?.language || stored || globalThis.navigator?.language }, {});
}

// Loaded twice (resource and extra JS URL): the second copy registers and logs nothing.
const vcFirstLoad = !customElements.get('vehicle-consumption-card');
const vcDefine = (name, cls) => {
  if (!customElements.get(name)) customElements.define(name, cls);
};
vcDefine('vehicle-consumption-card', VehicleConsumptionCard);
vcDefine('vehicle-consumption-card-editor', VehicleConsumptionCardEditor);
vcDefine('vehicle-consumption-mini-card', VehicleConsumptionMiniCard);
vcDefine('vehicle-consumption-mini-card-editor', VehicleConsumptionMiniCardEditor);

window.customCards = window.customCards || [];
{
  const lang = vcPickerLang();
  for (const [type, name, description] of [
    ['vehicle-consumption-card', 'card_name', 'card_desc'],
    ['vehicle-consumption-mini-card', 'mini_name', 'mini_desc'],
  ]) {
    if (window.customCards.some((card) => card.type === type)) continue;
    window.customCards.push({
      type,
      name: vcT(lang, name),
      description: vcT(lang, description),
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-vehicle-consumption',
    });
  }
}
if (vcFirstLoad) {
  console.info(
    `%c VEHICLE-CONSUMPTION-CARD %c v${VEHICLE_CONSUMPTION_CARD_VERSION} `,
    'background:#0ea5e9;color:#fff;font-weight:700',
    '',
  );
}
