/*!
 * Void Dissolve — organic singularities + zodiac constellation mode
 * When all three center panels dissolve, primaries form a zodiac sky: the active
 * constellation spans the search bar, the others rest faintly on a rotating wheel.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'voidDissolveState';
  const PARTICLE_COUNT = 28;
  const DISSOLVE_MS = 720;
  const RESTORE_MS = 560;
  const OFFSET_RADIUS_MIN = 12;
  const OFFSET_RADIUS_MAX = 28;
  const SINGULARITY_GAP = 36;
  const PRIMARY_IDS = ['todo', 'goals', 'echo'];
  const PANEL_THEME = { todo: 'today', goals: 'goals', echo: 'echo' };
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ترتیبِ واقعیِ دایرة‌البروج (مارافسا بینِ عقرب و کمان). مختصاتِ ستاره‌ها از RA/Dec
  // واقعی با تصویرِ نقشهٔ آسمان (شرق سمتِ چپ) محاسبه شده و هر شکل به‌گونه‌ای نرمال
  // شده که بزرگ‌ترین نیم‌بعدش = ۱ باشد؛ اندازهٔ نهایی را layoutSky از روی پهنای نوارِ
  // جستجو می‌گیرد. سه لنگر به‌ترتیبِ چپ→راست = Today / Goals / Echo.
  const ZODIAC = [
  {
    "id": "aries",
    "name": "Aries",
    "caption": "The Ram — a spark of beginnings",
    "yAxis": "down",
    "scale": 100,
    "stars": [
      { "id": "hamal", "x": 0.645, "y": 0.081, "role": "anchor", "mag": 0.73 },
      { "id": "sheratan", "x": 0.97, "y": 0.385, "role": "helper", "mag": 0.58 },
      { "id": "mesarthim", "x": 1.0, "y": 0.557, "role": "anchor", "mag": 0.3 },
      { "id": "c41_ari", "x": -0.466, "y": -0.352, "role": "anchor", "mag": 0.36 },
      { "id": "c39_ari", "x": -0.364, "y": -0.557, "role": "helper", "mag": 0.2 },
      { "id": "botein", "x": -1.0, "y": 0.508, "role": "helper", "mag": 0.2 }
    ],
    "anchors": {"today": "c41_ari", "goals": "hamal", "echo": "mesarthim"},
    "edges": [["c39_ari", "c41_ari"], ["c41_ari", "hamal"], ["hamal", "sheratan"], ["sheratan", "mesarthim"]]
  },
  {
    "id": "taurus",
    "name": "Taurus",
    "caption": "The Bull — horns facing the dawn",
    "yAxis": "down",
    "scale": 92,
    "stars": [
      { "id": "aldebaran", "x": 0.12, "y": 0.313, "role": "anchor", "mag": 0.99 },
      { "id": "elnath", "x": -0.794, "y": -0.625, "role": "anchor", "mag": 0.81 },
      { "id": "zeta_tau", "x": -1.0, "y": -0.046, "role": "helper", "mag": 0.5 },
      { "id": "gamma_tau", "x": 0.413, "y": 0.382, "role": "helper", "mag": 0.35 },
      { "id": "delta1_tau", "x": 0.356, "y": 0.233, "role": "helper", "mag": 0.33 },
      { "id": "epsilon_tau", "x": 0.253, "y": 0.106, "role": "helper", "mag": 0.38 },
      { "id": "theta2_tau", "x": 0.252, "y": 0.363, "role": "helper", "mag": 0.41 },
      { "id": "lambda_tau", "x": 0.76, "y": 0.625, "role": "anchor", "mag": 0.39 },
      { "id": "alcyone", "x": 1.0, "y": -0.276, "role": "helper", "mag": 0.53 }
    ],
    "anchors": {"today": "elnath", "goals": "aldebaran", "echo": "lambda_tau"},
    "edges": [["lambda_tau", "gamma_tau"], ["gamma_tau", "theta2_tau"], ["theta2_tau", "aldebaran"], ["aldebaran", "zeta_tau"], ["gamma_tau", "delta1_tau"], ["delta1_tau", "epsilon_tau"], ["epsilon_tau", "elnath"]]
  },
  {
    "id": "gemini",
    "name": "Gemini",
    "caption": "The Twins — two paths rising together",
    "yAxis": "down",
    "scale": 88,
    "stars": [
      { "id": "castor", "x": -0.764, "y": -0.909, "role": "anchor", "mag": 0.82 },
      { "id": "pollux", "x": -1.0, "y": -0.539, "role": "anchor", "mag": 0.92 },
      { "id": "alhena", "x": 0.494, "y": 0.573, "role": "anchor", "mag": 0.74 },
      { "id": "wasat", "x": -0.443, "y": 0.039, "role": "helper", "mag": 0.38 },
      { "id": "mebsuta", "x": 0.358, "y": -0.262, "role": "helper", "mag": 0.49 },
      { "id": "tejat", "x": 0.821, "y": -0.012, "role": "helper", "mag": 0.53 },
      { "id": "propus", "x": 1.0, "y": -0.011, "role": "helper", "mag": 0.43 },
      { "id": "mekbuda", "x": -0.09, "y": 0.174, "role": "helper", "mag": 0.32 },
      { "id": "alzirr", "x": 0.327, "y": 0.909, "role": "helper", "mag": 0.42 },
      { "id": "tau_gem", "x": -0.244, "y": -0.751, "role": "helper", "mag": 0.2 }
    ],
    "anchors": {"today": "pollux", "goals": "castor", "echo": "alhena"},
    "edges": [["castor", "tau_gem"], ["tau_gem", "mebsuta"], ["mebsuta", "tejat"], ["tejat", "propus"], ["pollux", "wasat"], ["wasat", "mekbuda"], ["mekbuda", "alhena"], ["alhena", "alzirr"], ["mebsuta", "wasat"]]
  },
  {
    "id": "cancer",
    "name": "Cancer",
    "caption": "The Crab — a quiet doorway of stars",
    "yAxis": "down",
    "scale": 105,
    "stars": [
      { "id": "acubens", "x": -0.507, "y": 0.727, "role": "anchor", "mag": 0.22 },
      { "id": "altarf", "x": 0.507, "y": 1.0, "role": "anchor", "mag": 0.38 },
      { "id": "asellus_australis", "x": -0.174, "y": 0.084, "role": "helper", "mag": 0.29 },
      { "id": "asellus_borealis", "x": -0.141, "y": -0.255, "role": "helper", "mag": 0.2 },
      { "id": "iota_cnc", "x": -0.222, "y": -1.0, "role": "anchor", "mag": 0.27 },
      { "id": "praesepe", "x": -0.065, "y": -0.103, "role": "helper", "mag": 0.34 }
    ],
    "anchors": {"today": "acubens", "goals": "iota_cnc", "echo": "altarf"},
    "edges": [["altarf", "asellus_australis"], ["asellus_australis", "asellus_borealis"], ["asellus_borealis", "iota_cnc"], ["asellus_australis", "acubens"]]
  },
  {
    "id": "leo",
    "name": "Leo",
    "caption": "The Lion — a royal heart beneath the stars",
    "yAxis": "down",
    "scale": 90,
    "stars": [
      { "id": "regulus", "x": 0.635, "y": 0.482, "role": "anchor", "mag": 0.88 },
      { "id": "denebola", "x": -1.0, "y": 0.303, "role": "anchor", "mag": 0.7 },
      { "id": "algieba", "x": 0.446, "y": -0.059, "role": "anchor", "mag": 0.72 },
      { "id": "zosma", "x": -0.432, "y": -0.106, "role": "helper", "mag": 0.6 },
      { "id": "chertan", "x": -0.434, "y": 0.244, "role": "helper", "mag": 0.42 },
      { "id": "adhafera", "x": 0.5, "y": -0.304, "role": "helper", "mag": 0.4 },
      { "id": "rasalas", "x": 0.888, "y": -0.482, "role": "helper", "mag": 0.3 },
      { "id": "algenubi", "x": 1.0, "y": -0.329, "role": "helper", "mag": 0.5 },
      { "id": "eta_leo", "x": 0.651, "y": 0.153, "role": "helper", "mag": 0.38 }
    ],
    "anchors": {"today": "denebola", "goals": "algieba", "echo": "regulus"},
    "edges": [["regulus", "eta_leo"], ["eta_leo", "algieba"], ["algieba", "adhafera"], ["adhafera", "rasalas"], ["rasalas", "algenubi"], ["algieba", "zosma"], ["zosma", "denebola"], ["zosma", "chertan"], ["chertan", "denebola"], ["chertan", "regulus"]]
  },
  {
    "id": "virgo",
    "name": "Virgo",
    "caption": "The Maiden — a long river of light",
    "yAxis": "down",
    "scale": 88,
    "stars": [
      { "id": "spica", "x": -0.096, "y": 0.513, "role": "anchor", "mag": 0.96 },
      { "id": "vindemiatrix", "x": 0.171, "y": -0.513, "role": "anchor", "mag": 0.54 },
      { "id": "porrima", "x": 0.409, "y": 0.063, "role": "helper", "mag": 0.56 },
      { "id": "zavijava", "x": 1.0, "y": -0.087, "role": "anchor", "mag": 0.36 },
      { "id": "zaniah", "x": 0.661, "y": 0.026, "role": "helper", "mag": 0.3 },
      { "id": "auva", "x": 0.247, "y": -0.162, "role": "helper", "mag": 0.41 },
      { "id": "heze", "x": -0.206, "y": 0.023, "role": "helper", "mag": 0.42 },
      { "id": "syrma", "x": -0.685, "y": 0.274, "role": "helper", "mag": 0.25 },
      { "id": "mu_vir", "x": -1.0, "y": 0.258, "role": "helper", "mag": 0.3 }
    ],
    "anchors": {"today": "spica", "goals": "vindemiatrix", "echo": "zavijava"},
    "edges": [["zavijava", "zaniah"], ["zaniah", "porrima"], ["porrima", "auva"], ["auva", "vindemiatrix"], ["porrima", "heze"], ["heze", "spica"], ["heze", "syrma"], ["syrma", "mu_vir"]]
  },
  {
    "id": "libra",
    "name": "Libra",
    "caption": "The Scales — balance held in the dark",
    "yAxis": "down",
    "scale": 100,
    "stars": [
      { "id": "zubeneschamali", "x": -0.055, "y": -1.0, "role": "anchor", "mag": 0.59 },
      { "id": "zubenelgenubi", "x": 0.547, "y": -0.347, "role": "anchor", "mag": 0.56 },
      { "id": "zubenelhakrabi", "x": -0.484, "y": -0.47, "role": "helper", "mag": 0.29 },
      { "id": "sigma_lib", "x": 0.243, "y": 0.559, "role": "helper", "mag": 0.43 },
      { "id": "upsilon_lib", "x": -0.518, "y": 0.839, "role": "helper", "mag": 0.37 },
      { "id": "tau_lib", "x": -0.547, "y": 1.0, "role": "anchor", "mag": 0.35 }
    ],
    "anchors": {"today": "tau_lib", "goals": "zubeneschamali", "echo": "zubenelgenubi"},
    "edges": [["zubenelgenubi", "zubeneschamali"], ["zubeneschamali", "zubenelhakrabi"], ["zubenelhakrabi", "zubenelgenubi"], ["zubenelgenubi", "sigma_lib"], ["zubenelhakrabi", "upsilon_lib"], ["upsilon_lib", "tau_lib"]]
  },
  {
    "id": "scorpius",
    "name": "Scorpius",
    "caption": "The Scorpion — a crimson hook in the Milky Way",
    "yAxis": "down",
    "scale": 82,
    "stars": [
      { "id": "antares", "x": 0.428, "y": -0.414, "role": "anchor", "mag": 0.94 },
      { "id": "shaula", "x": -0.725, "y": 0.484, "role": "anchor", "mag": 0.81 },
      { "id": "sargas", "x": -0.792, "y": 0.98, "role": "helper", "mag": 0.76 },
      { "id": "dschubba", "x": 0.95, "y": -0.734, "role": "helper", "mag": 0.65 },
      { "id": "acrab", "x": 0.859, "y": -0.971, "role": "anchor", "mag": 0.59 },
      { "id": "larawag", "x": 0.055, "y": 0.248, "role": "helper", "mag": 0.66 },
      { "id": "jabbah", "x": 0.943, "y": -1.0, "role": "helper", "mag": 0.27 },
      { "id": "pi_sco", "x": 0.976, "y": -0.44, "role": "helper", "mag": 0.53 },
      { "id": "sigma_sco", "x": 0.575, "y": -0.484, "role": "helper", "mag": 0.53 },
      { "id": "tau_sco", "x": 0.311, "y": -0.264, "role": "helper", "mag": 0.54 },
      { "id": "mu1_sco", "x": 0.025, "y": 0.563, "role": "helper", "mag": 0.49 },
      { "id": "zeta2_sco", "x": -0.02, "y": 0.926, "role": "helper", "mag": 0.36 },
      { "id": "eta_sco", "x": -0.34, "y": 1.0, "role": "helper", "mag": 0.42 },
      { "id": "iota1_sco", "x": -0.976, "y": 0.738, "role": "helper", "mag": 0.49 },
      { "id": "kappa_sco", "x": -0.885, "y": 0.646, "role": "helper", "mag": 0.63 },
      { "id": "lesath", "x": -0.674, "y": 0.5, "role": "helper", "mag": 0.57 }
    ],
    "anchors": {"today": "shaula", "goals": "antares", "echo": "acrab"},
    "edges": [["jabbah", "acrab"], ["acrab", "dschubba"], ["dschubba", "pi_sco"], ["dschubba", "sigma_sco"], ["sigma_sco", "antares"], ["antares", "tau_sco"], ["tau_sco", "larawag"], ["larawag", "mu1_sco"], ["mu1_sco", "zeta2_sco"], ["zeta2_sco", "eta_sco"], ["eta_sco", "sargas"], ["sargas", "iota1_sco"], ["iota1_sco", "kappa_sco"], ["kappa_sco", "shaula"], ["shaula", "lesath"]]
  },
  {
    "id": "ophiuchus",
    "name": "Ophiuchus",
    "caption": "The Serpent-Bearer — the 13th constellation on the ecliptic, not a 13th zodiac sign",
    "yAxis": "down",
    "scale": 92,
    "stars": [
      { "id": "rasalhague", "x": -0.375, "y": -1.0, "role": "anchor", "mag": 0.71 },
      { "id": "cebalrai", "x": -0.488, "y": -0.574, "role": "helper", "mag": 0.55 },
      { "id": "kappa_oph", "x": 0.118, "y": -0.83, "role": "helper", "mag": 0.45 },
      { "id": "marfik", "x": 0.472, "y": -0.437, "role": "helper", "mag": 0.31 },
      { "id": "yed_prior", "x": 0.692, "y": -0.134, "role": "anchor", "mag": 0.56 },
      { "id": "yed_posterior", "x": 0.639, "y": -0.081, "role": "helper", "mag": 0.46 },
      { "id": "zeta_oph", "x": 0.39, "y": 0.232, "role": "helper", "mag": 0.6 },
      { "id": "sabik", "x": -0.05, "y": 0.506, "role": "anchor", "mag": 0.63 },
      { "id": "theta_oph", "x": -0.203, "y": 1.0, "role": "helper", "mag": 0.44 },
      { "id": "gamma_oph", "x": -0.268, "y": -0.475, "role": "helper", "mag": 0.33 },
      { "id": "nu_oph", "x": -0.692, "y": 0.189, "role": "helper", "mag": 0.42 }
    ],
    "anchors": {"today": "rasalhague", "goals": "sabik", "echo": "yed_prior"},
    "edges": [["rasalhague", "cebalrai"], ["rasalhague", "kappa_oph"], ["kappa_oph", "marfik"], ["marfik", "yed_prior"], ["yed_prior", "yed_posterior"], ["yed_posterior", "zeta_oph"], ["zeta_oph", "sabik"], ["sabik", "theta_oph"], ["cebalrai", "gamma_oph"], ["gamma_oph", "nu_oph"], ["nu_oph", "sabik"]]
  },
  {
    "id": "sagittarius",
    "name": "Sagittarius",
    "caption": "The Archer — the Teapot beside the galactic heart",
    "yAxis": "down",
    "scale": 82,
    "stars": [
      { "id": "kaus_australis", "x": 0.399, "y": 0.676, "role": "anchor", "mag": 0.76 },
      { "id": "kaus_media", "x": 0.503, "y": -0.011, "role": "helper", "mag": 0.57 },
      { "id": "kaus_borealis", "x": 0.276, "y": -0.676, "role": "helper", "mag": 0.54 },
      { "id": "nunki", "x": -0.617, "y": -0.544, "role": "anchor", "mag": 0.72 },
      { "id": "ascella", "x": -0.857, "y": -0.004, "role": "helper", "mag": 0.59 },
      { "id": "tau_sgr", "x": -1.0, "y": -0.337, "role": "helper", "mag": 0.43 },
      { "id": "phi_sgr", "x": -0.303, "y": -0.44, "role": "helper", "mag": 0.46 },
      { "id": "alnasl", "x": 1.0, "y": 0.079, "role": "anchor", "mag": 0.5 }
    ],
    "anchors": {"today": "nunki", "goals": "kaus_australis", "echo": "alnasl"},
    "edges": [["alnasl", "kaus_media"], ["kaus_media", "kaus_australis"], ["kaus_australis", "ascella"], ["ascella", "tau_sgr"], ["tau_sgr", "nunki"], ["nunki", "phi_sgr"], ["phi_sgr", "kaus_borealis"], ["kaus_borealis", "kaus_media"], ["phi_sgr", "ascella"]]
  },
  {
    "id": "capricornus",
    "name": "Capricornus",
    "caption": "The Sea-Goat — an ancient vessel of stars",
    "yAxis": "down",
    "scale": 94,
    "stars": [
      { "id": "algedi", "x": 1.0, "y": -0.683, "role": "anchor", "mag": 0.37 },
      { "id": "dabih", "x": 0.925, "y": -0.471, "role": "helper", "mag": 0.48 },
      { "id": "theta_cap", "x": -0.081, "y": -0.238, "role": "helper", "mag": 0.26 },
      { "id": "iota_cap", "x": -0.444, "y": -0.276, "role": "helper", "mag": 0.21 },
      { "id": "nashira", "x": -0.844, "y": -0.292, "role": "helper", "mag": 0.35 },
      { "id": "deneb_algedi", "x": -1.0, "y": -0.343, "role": "anchor", "mag": 0.53 },
      { "id": "psi_cap", "x": 0.364, "y": 0.527, "role": "helper", "mag": 0.24 },
      { "id": "omega_cap", "x": 0.24, "y": 0.683, "role": "anchor", "mag": 0.25 },
      { "id": "zeta_cap", "x": -0.548, "y": 0.255, "role": "helper", "mag": 0.33 },
      { "id": "epsilon_cap", "x": -0.78, "y": -0.025, "role": "helper", "mag": 0.2 }
    ],
    "anchors": {"today": "deneb_algedi", "goals": "omega_cap", "echo": "algedi"},
    "edges": [["algedi", "dabih"], ["dabih", "theta_cap"], ["theta_cap", "iota_cap"], ["iota_cap", "nashira"], ["nashira", "deneb_algedi"], ["dabih", "psi_cap"], ["psi_cap", "omega_cap"], ["omega_cap", "zeta_cap"], ["zeta_cap", "epsilon_cap"], ["epsilon_cap", "deneb_algedi"]]
  },
  {
    "id": "aquarius",
    "name": "Aquarius",
    "caption": "The Water Bearer — a stream falling through space",
    "yAxis": "down",
    "scale": 88,
    "stars": [
      { "id": "sadalsuud", "x": 0.309, "y": -0.105, "role": "helper", "mag": 0.52 },
      { "id": "sadalmelik", "x": -0.23, "y": -0.438, "role": "anchor", "mag": 0.51 },
      { "id": "skat", "x": -1.0, "y": 0.546, "role": "anchor", "mag": 0.44 },
      { "id": "albali", "x": 1.0, "y": 0.144, "role": "anchor", "mag": 0.33 },
      { "id": "sadachbia", "x": -0.48, "y": -0.371, "role": "helper", "mag": 0.31 },
      { "id": "zeta_aqr", "x": -0.593, "y": -0.457, "role": "helper", "mag": 0.35 },
      { "id": "eta_aqr", "x": -0.696, "y": -0.451, "role": "helper", "mag": 0.27 },
      { "id": "pi_aqr", "x": -0.537, "y": -0.546, "role": "helper", "mag": 0.2 },
      { "id": "lambda_aqr", "x": -0.968, "y": 0.023, "role": "helper", "mag": 0.33 },
      { "id": "ancha", "x": -0.405, "y": 0.036, "role": "helper", "mag": 0.23 }
    ],
    "anchors": {"today": "skat", "goals": "sadalmelik", "echo": "albali"},
    "edges": [["albali", "sadalsuud"], ["sadalsuud", "sadalmelik"], ["sadalmelik", "sadachbia"], ["sadachbia", "zeta_aqr"], ["zeta_aqr", "eta_aqr"], ["zeta_aqr", "pi_aqr"], ["eta_aqr", "lambda_aqr"], ["lambda_aqr", "skat"]]
  },
  {
    "id": "pisces",
    "name": "Pisces",
    "caption": "The Fish — two currents joined by one thread",
    "yAxis": "down",
    "scale": 88,
    "stars": [
      { "id": "gamma_psc", "x": 1.0, "y": 0.246, "role": "helper", "mag": 0.34 },
      { "id": "kappa_psc", "x": 0.881, "y": 0.345, "role": "helper", "mag": 0.2 },
      { "id": "lambda_psc", "x": 0.697, "y": 0.32, "role": "helper", "mag": 0.2 },
      { "id": "iota_psc", "x": 0.724, "y": 0.131, "role": "helper", "mag": 0.24 },
      { "id": "theta_psc", "x": 0.869, "y": 0.094, "role": "anchor", "mag": 0.21 },
      { "id": "omega_psc", "x": 0.489, "y": 0.071, "role": "helper", "mag": 0.27 },
      { "id": "epsilon_psc", "x": -0.283, "y": 0.02, "role": "anchor", "mag": 0.21 },
      { "id": "delta_psc", "x": -0.11, "y": 0.035, "role": "helper", "mag": 0.2 },
      { "id": "mu_psc", "x": -0.379, "y": 0.106, "role": "helper", "mag": 0.2 },
      { "id": "nu_psc", "x": -0.742, "y": 0.138, "role": "helper", "mag": 0.2 },
      { "id": "alrescha", "x": -1.0, "y": 0.272, "role": "anchor", "mag": 0.31 },
      { "id": "omicron_psc", "x": -0.798, "y": -0.042, "role": "helper", "mag": 0.21 },
      { "id": "eta_psc", "x": -0.629, "y": -0.345, "role": "helper", "mag": 0.36 }
    ],
    "anchors": {"today": "alrescha", "goals": "epsilon_psc", "echo": "theta_psc"},
    "edges": [["gamma_psc", "kappa_psc"], ["kappa_psc", "lambda_psc"], ["lambda_psc", "iota_psc"], ["iota_psc", "theta_psc"], ["theta_psc", "gamma_psc"], ["iota_psc", "omega_psc"], ["omega_psc", "delta_psc"], ["delta_psc", "epsilon_psc"], ["epsilon_psc", "mu_psc"], ["mu_psc", "nu_psc"], ["nu_psc", "alrescha"], ["alrescha", "omicron_psc"], ["omicron_psc", "eta_psc"]]
  }
  ];

  /** @type {Record<string, any>} */
  const registry = Object.create(null);
  let savedState = Object.create(null);
  let stateLoaded = false;
  let activeConstellation = null; // { id, centerX, centerY }
  let constellationLayer = null;
  let hydrateScheduled = false;

  const layer = document.createElement('div');
  layer.id = 'ai-void-dissolve-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.documentElement.appendChild(layer);

  let _loadCallbacks = [];
  function loadState(cb) {
    if (typeof cb === 'function') _loadCallbacks.push(cb);
    if (stateLoaded) {
      const q = _loadCallbacks.splice(0, _loadCallbacks.length);
      q.forEach(function (fn) { try { fn(); } catch (e) {} });
      return;
    }
    if (loadState._inflight) return;
    loadState._inflight = true;
    const finish = function (state) {
      savedState = state && typeof state === 'object' ? state : {};
      stateLoaded = true;
      loadState._inflight = false;
      const q = _loadCallbacks.splice(0, _loadCallbacks.length);
      q.forEach(function (fn) { try { fn(); } catch (e) {} });
      try {
        window.dispatchEvent(new CustomEvent('void-dissolve-ready', { detail: { state: savedState } }));
      } catch (e) {}
    };
    try {
      chrome.storage.local.get([STORAGE_KEY], function (res) {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish({});
          return;
        }
        finish((res && res[STORAGE_KEY] && typeof res[STORAGE_KEY] === 'object') ? res[STORAGE_KEY] : {});
      });
    } catch (e) {
      finish({});
    }
  }

  function persist() {
    try {
      const payload = Object.assign({}, savedState);
      if (activeConstellation) {
        payload.__constellation = {
          id: activeConstellation.id,
          cx: activeConstellation.centerX,
          cy: activeConstellation.centerY
        };
      } else {
        delete payload.__constellation;
      }
      chrome.storage.local.set({ [STORAGE_KEY]: payload });
    } catch (e) {}
  }

  function labelText(entry) {
    try {
      if (typeof t === 'function') {
        const raw = t('voidDissolveRestore');
        if (raw) return String(raw).replace('{name}', entry.label);
      }
    } catch (e) {}
    return 'Restore ' + entry.label;
  }

  function zodiacName(z) {
    if (!z) return '';
    try {
      if (typeof t === 'function') {
        const k = 'zodiacName_' + z.id;
        const v = t(k);
        if (v && v !== k) return v;
      }
    } catch (e) {}
    return z.name || z.id;
  }

  function zodiacCaption(z) {
    if (!z) return '';
    try {
      if (typeof t === 'function') {
        const k = 'zodiacCaption_' + z.id;
        const v = t(k);
        if (v && v !== k) return v;
      }
    } catch (e) {}
    return z.caption || '';
  }

  // یک خطِ گلچین‌شدهٔ اضافه — عنصر/کیفیت/حاکمِ سنتی، یا برایِ Ophiuchus
  // یادداشتِ «سیزدهمین صورتِ فلکی». همون الگویِ t()-محورِ zodiacName/
  // zodiacCaption، پس با اضافه‌شدنِ کلیدهایِ واقعی به i18n.js خودکار
  // چندزبانه می‌شود؛ تا آن‌موقع، fallbackِ انگلیسی نشان داده می‌شود.
  const ZODIAC_TRAITS = {
    aries: { el: 'fire', mod: 'cardinal', ruler: 'mars' },
    taurus: { el: 'earth', mod: 'fixed', ruler: 'venus' },
    gemini: { el: 'air', mod: 'mutable', ruler: 'mercury' },
    cancer: { el: 'water', mod: 'cardinal', ruler: 'moon' },
    leo: { el: 'fire', mod: 'fixed', ruler: 'sun' },
    virgo: { el: 'earth', mod: 'mutable', ruler: 'mercury' },
    libra: { el: 'air', mod: 'cardinal', ruler: 'venus' },
    scorpius: { el: 'water', mod: 'fixed', ruler: 'mars' },
    sagittarius: { el: 'fire', mod: 'mutable', ruler: 'jupiter' },
    capricornus: { el: 'earth', mod: 'cardinal', ruler: 'saturn' },
    aquarius: { el: 'air', mod: 'fixed', ruler: 'saturn' },
    pisces: { el: 'water', mod: 'mutable', ruler: 'jupiter' }
  };
  const TRAIT_EN = {
    fire: 'Fire', earth: 'Earth', air: 'Air', water: 'Water',
    cardinal: 'Cardinal', fixed: 'Fixed', mutable: 'Mutable',
    mars: 'Mars', venus: 'Venus', mercury: 'Mercury', moon: 'Moon', sun: 'Sun', jupiter: 'Jupiter', saturn: 'Saturn'
  };
  function traitText(key) {
    try {
      if (typeof t === 'function') {
        const v = t('zodiacTrait_' + key);
        if (v && v !== 'zodiacTrait_' + key) return v;
      }
    } catch (e) {}
    return TRAIT_EN[key] || key;
  }
  function zodiacFacts(z) {
    if (!z) return '';
    if (z.id === 'ophiuchus') {
      try {
        if (typeof t === 'function') {
          const v = t('zodiacOphNote');
          if (v && v !== 'zodiacOphNote') return v;
        }
      } catch (e) {}
      return '13th constellation of the ecliptic';
    }
    const tr = ZODIAC_TRAITS[z.id];
    if (!tr) return '';
    return traitText(tr.el) + ' · ' + traitText(tr.mod) + ' · ' + traitText(tr.ruler);
  }

  // خطِ «عصر» فقط برای حوت (عصرِ فعلی) و دلو (عصرِ بعدی)؛ بقیه خالی.
  function zodiacAgeText(z) {
    if (!z) return '';
    const key = z.id === 'pisces' ? 'zodiacAgeNow' : z.id === 'aquarius' ? 'zodiacAgeNext' : '';
    if (!key) return '';
    const fallback = key === 'zodiacAgeNow'
      ? 'Age of Pisces \u00B7 the spring equinox still rests here'
      : 'Next age \u00B7 the equinox arrives around 2600';
    return navLabel(key, fallback);
  }

  function navLabel(key, fallback) {
    try {
      if (typeof t === 'function') {
        const v = t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  // =====================================================================
  // آسمانِ زودیاک
  // ---------------------------------------------------------------------
  // بعد از کلاپسِ سه منوی اصلی، هر ۱۳ صورتِ فلکی روی یک کمانِ بزرگ (یک
  // «چرخ») چیده می‌شوند. صورتِ فلکیِ فعال وسطِ صفحه، به پهنای نوارِ جستجو؛
  // همسایه‌ها کم‌رنگ و کوچک‌تر و کمی کج‌شده در دو طرف. چرخاندنِ چرخ (سوایپ،
  // کلیک رویِ همسایه، فلش‌ها، کیبورد، wheel افقی) کلِ چرخ را دورِ مرکزِ
  // کمان می‌چرخاند؛ سه ستارهٔ لنگر (Today/Goals/Echo) با چرخ حرکت می‌کنند
  // و موقعِ عبور به لنگرهای صورتِ فلکیِ بعدی می‌لغزند.
  //
  // همه‌چیز با یک عددِ پیوسته (sky.pos = «اندیسِ اعشاریِ صورتِ فلکیِ وسط»)
  // کنترل می‌شود؛ renderSky فقط تابعی از همین عدد است، پس درگ، فلیک و
  // انیمیشنِ دکمه‌ها همگی یک مسیر را می‌روند.
  // =====================================================================
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SKY_GLYPH = {
    aries: '\u2648', taurus: '\u2649', gemini: '\u264A', cancer: '\u264B', leo: '\u264C',
    virgo: '\u264D', libra: '\u264E', scorpius: '\u264F', ophiuchus: '\u26CE',
    sagittarius: '\u2650', capricornus: '\u2651', aquarius: '\u2652', pisces: '\u2653'
  };
  // [فاصلهٔ اندیسی از مرکز, شفافیت] — درون‌یابی نرم بینِ نقطه‌ها
  const SKY_FADE = [[0, 1], [0.22, 1], [1, 0.36], [2, 0.12], [2.8, 0]];
  const SKY_BELT_GAP = 36;          // فاصلهٔ کمربندِ نمادها از پایینِ شکل
  const SKY_CAPTION_RESERVE = 132;  // جا برای کمربند + کپشن زیرِ شکل
  const SKY_INTRO_MS = 1700;

  // ---- «عصر» (Age): نقطهٔ اعتدالِ بهاری، طبقِ مرزهای IAU --------------------
  // اعتدالِ بهاری حدودِ ۶۸ پیش‌ازمیلاد وارد حوت شد و حدودِ ۲۵۹۷ میلادی وارد دلو
  // می‌شود. یعنی از نظرِ نجومی هنوز «عصر حوت» است؛ دلو «عصرِ بعدی» است. اگر
  // خواستی روایتِ نجومیِ رایج («سپیده‌دمِ عصرِ دلو») را نشان بدهی، فقط کلیدهای
  // زبان و AGE_SHOW_AS_DAWN را عوض کن.
  const AGE_START_YEAR = -68;
  const AGE_END_YEAR = 2597;
  function ageProgress() {
    const d = new Date();
    const y = d.getFullYear() + d.getMonth() / 12;
    return skyClamp((y - AGE_START_YEAR) / (AGE_END_YEAR - AGE_START_YEAR), 0, 1);
  }

  let sky = null;

  function skyMod(a, n) { return ((a % n) + n) % n; }
  function skyWrap(d, n) { d = skyMod(d, n); return d > n / 2 ? d - n : d; }
  function skyClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function skyEaseInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function skyEaseOut(t) { return 1 - Math.pow(1 - t, 3); }
  function skyFade(ad) {
    for (let i = 1; i < SKY_FADE.length; i++) {
      const a = SKY_FADE[i - 1], b = SKY_FADE[i];
      if (ad <= b[0]) {
        const t = (ad - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * (t * t * (3 - 2 * t));
      }
    }
    return 0;
  }
  function skyEl(name, attrs, cls) {
    const el = document.createElementNS(SVG_NS, name);
    if (cls) el.setAttribute('class', cls);
    if (attrs) Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }

  // ---- کپشن (نام + توضیح + ویژگی‌ها) با فلش‌های قبلی/بعدی ----------------
  function buildCaptionBlock() {
    const cap = document.createElement('div');
    cap.className = 'ai-void-constellation-caption';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'ai-void-constellation-nav ai-void-constellation-prev';
    prevBtn.textContent = '\u2039';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'ai-void-constellation-nav ai-void-constellation-next';
    nextBtn.textContent = '\u203A';
    [[prevBtn, -1], [nextBtn, 1]].forEach(function (pair) {
      pair[0].addEventListener('click', function (e) { e.stopPropagation(); skyStep(pair[1]); });
    });
    const prevL = navLabel('voidZodiacPrev', 'Previous constellation');
    const nextL = navLabel('voidZodiacNext', 'Next constellation');
    prevBtn.title = prevL; prevBtn.setAttribute('aria-label', prevL);
    nextBtn.title = nextL; nextBtn.setAttribute('aria-label', nextL);

    const textWrap = document.createElement('div');
    textWrap.className = 'ai-void-constellation-text';
    textWrap.setAttribute('aria-live', 'polite');
    const title = document.createElement('div');
    title.className = 'ai-void-constellation-name';
    const blurb = document.createElement('div');
    blurb.className = 'ai-void-constellation-blurb';
    const facts = document.createElement('div');
    facts.className = 'ai-void-constellation-facts';
    const age = document.createElement('div');
    age.className = 'ai-void-constellation-age';
    textWrap.append(title, blurb, facts, age);

    cap.append(prevBtn, textWrap, nextBtn);
    cap._parts = { textWrap: textWrap, title: title, blurb: blurb, facts: facts, age: age };
    return cap;
  }

  function skyFillCaption(z) {
    if (!sky || !sky.caption || !z) return;
    const p = sky.caption._parts;
    p.title.textContent = zodiacName(z);
    p.blurb.textContent = zodiacCaption(z);
    p.facts.textContent = zodiacFacts(z);
    p.age.textContent = zodiacAgeText(z);
  }

  function refreshConstellationCaption() {
    if (!sky) return;
    const n = sky.cons.length;
    skyFillCaption(sky.cons[skyMod(Math.round(sky.pos), n)].z);
  }

  // ---- هندسه: نوارِ جستجو → عرضِ شکل، زیرِ لینک‌های پرکاربرد → ارتفاع ----
  function skyAnchorBox() {
    const vw = window.innerWidth, vh = window.innerHeight;
    let midX = vw / 2;
    let barW = Math.min(640, vw - 32);
    let anchorBottom = Math.max(88, vh * 0.18) + 160;
    try {
      const stage = document.getElementById('ai-void-stage');
      if (stage) {
        const r = stage.getBoundingClientRect();
        if (r.width > 40 && r.height > 20) {
          midX = r.left + r.width / 2;
          barW = r.width;
          anchorBottom = r.bottom;
        }
      }
      const form = document.getElementById('ai-void-search-form');
      if (form) {
        const fr = form.getBoundingClientRect();
        if (fr.width > 80) { midX = fr.left + fr.width / 2; barW = fr.width; }
      }
      const topsites = document.getElementById('ai-ntp-topsites');
      if (topsites && !topsites.classList.contains('hidden') && topsites.offsetParent !== null) {
        const tr = topsites.getBoundingClientRect();
        if (tr.height > 4 && tr.bottom > 0) anchorBottom = tr.bottom;
      }
    } catch (e) {}
    return { vw: vw, vh: vh, midX: midX, barW: barW, anchorBottom: anchorBottom };
  }

  function layoutSky() {
    if (!sky) return;
    const box = skyAnchorBox();
    const vw = box.vw, vh = box.vh;
    const W = skyClamp(box.barW, 260, Math.max(260, Math.min(700, vw - 24)));
    const top = box.anchorBottom + 12;
    const H = skyClamp(vh - top - SKY_CAPTION_RESERVE, 110, Math.min(320, W * 0.55));
    const S = skyClamp(W * 0.9, 230, 640);     // فاصلهٔ مرکزِ دو صورتِ فلکیِ مجاور
    const R = S * 4.5;                          // شعاعِ چرخ (خیلی بزرگ → انحنای ملایم)
    const step = S / R;
    const cx = skyClamp(box.midX, Math.min(W / 2 + 8, vw / 2), Math.max(vw - W / 2 - 8, vw / 2));
    const cy = top + H / 2;

    const key = [vw, vh, Math.round(W), Math.round(H), Math.round(cx), Math.round(cy)].join('|');
    if (sky.layoutKey === key) return;
    sky.layoutKey = key;

    const Rb = R - H / 2 - SKY_BELT_GAP;
    const g = sky.geo = {
      vw: vw, vh: vh, W: W, H: H, S: S, R: R, step: step, cx: cx, cy: cy,
      pivotY: cy + R, Rb: Rb, Rg: Rb + 14, phiMax: step * 2.7, beltP: Rb * step
    };

    // هر صورتِ فلکی در جعبهٔ W×H جا می‌شود (نسبتِ واقعی حفظ می‌شود)
    const halfW = Math.max(40, W / 2 - 16), halfH = Math.max(40, H / 2 - 8);
    sky.cons.forEach((c) => {
      const u = Math.min(halfW / Math.max(c.hx, 0.01), halfH / Math.max(c.hy, 0.01));
      c.u = u;
      c.stars.forEach((s) => {
        s.lx = s.x * u; s.ly = s.y * u;
        const r = 1.2 + s.mag * 2.0;
        s.core.setAttribute('cx', s.lx.toFixed(2)); s.core.setAttribute('cy', s.ly.toFixed(2)); s.core.setAttribute('r', r.toFixed(2));
        s.halo.setAttribute('cx', s.lx.toFixed(2)); s.halo.setAttribute('cy', s.ly.toFixed(2)); s.halo.setAttribute('r', (r * 4.4).toFixed(2));
      });
      c.edges.forEach((e) => {
        e.el.setAttribute('x1', e.a.lx.toFixed(2)); e.el.setAttribute('y1', e.a.ly.toFixed(2));
        e.el.setAttribute('x2', e.b.lx.toFixed(2)); e.el.setAttribute('y2', e.b.ly.toFixed(2));
      });
    });

    // کمربندِ نمادها: کمانِ هم‌مرکز با چرخ، زیرِ شکل‌ها
    const phiM = g.phiMax;
    const x0 = cx - Rb * Math.sin(phiM), x1 = cx + Rb * Math.sin(phiM);
    const y0 = g.pivotY - Rb * Math.cos(phiM);
    const d = 'M ' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A ' + Rb.toFixed(2) + ' ' + Rb.toFixed(2) + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y0.toFixed(2);
    sky.beltLine.setAttribute('d', d);
    sky.beltTicks.setAttribute('d', d);
    sky.beltTicks.setAttribute('stroke-dasharray', '1.4 ' + Math.max(1, g.beltP - 1.4).toFixed(2));
    sky.beltGrad.setAttribute('x1', x0.toFixed(2));
    sky.beltGrad.setAttribute('x2', x1.toFixed(2));

    // ناحیهٔ سوایپ: فقط همین باند (نه کلِ صفحه) تا با چیزهای دیگر تداخل نکند
    sky.zone.style.top = Math.max(0, cy - H / 2 - 14) + 'px';
    sky.zone.style.height = (H + SKY_BELT_GAP + 104) + 'px';

    sky.caption.style.left = cx + 'px';
    sky.caption.style.top = (cy + H / 2 + SKY_BELT_GAP + 14) + 'px';
  }

  // موقعیتِ جهانیِ یک ستاره (بعد از چرخش/مقیاسِ گروهش)
  function skyStarWorld(c, starId) {
    const s = c.sm[starId];
    if (!s || !c.pl) return null;
    const p = c.pl;
    return {
      x: p.X + p.k * (s.lx * p.cos - s.ly * p.sin),
      y: p.Y + p.k * (s.lx * p.sin + s.ly * p.cos)
    };
  }

  function renderSky(now) {
    if (!sky || !sky.geo) return;
    const g = sky.geo, N = sky.cons.length, pos = sky.pos;

    let introF = 1;
    if (sky.intro) {
      if (now >= sky.introEnd) sky.intro = false;
      else introF = skyEaseOut(skyClamp((now - sky.introStart - 450) / 1100, 0, 1));
    }

    for (let i = 0; i < N; i++) {
      const c = sky.cons[i];
      const d = skyWrap(i - pos, N);
      const ad = Math.abs(d);
      const phi = d * g.step;
      const k = 1 - 0.30 * Math.min(ad, 1) - 0.08 * skyClamp(ad - 1, 0, 1);
      const sn = Math.sin(phi), cs = Math.cos(phi);
      const X = g.cx + g.R * sn;
      const Y = g.cy + g.R * (1 - cs);
      c.d = d;
      c.pl = { X: X, Y: Y, phi: phi, k: k, sin: sn, cos: cs };

      let op = skyFade(ad);
      if (ad > 0.6) op *= introF;
      if (op < 0.012) {
        if (c.vis) { c.g.setAttribute('visibility', 'hidden'); c.glyph.setAttribute('visibility', 'hidden'); c.vis = false; }
        continue;
      }
      if (!c.vis) { c.g.setAttribute('visibility', 'visible'); c.glyph.setAttribute('visibility', 'visible'); c.vis = true; }
      const deg = (phi * 57.29578).toFixed(3);
      c.g.setAttribute('opacity', op.toFixed(3));
      c.g.setAttribute('transform', 'translate(' + X.toFixed(2) + ' ' + Y.toFixed(2) + ') rotate(' + deg + ') scale(' + k.toFixed(4) + ')');
      const near = ad < 0.5;
      if (near !== c.near) { c.near = near; c.g.classList.toggle('is-near', near); }
      const gx = g.cx + g.Rg * sn, gy = g.pivotY - g.Rg * cs;
      c.glyph.setAttribute('opacity', (op * 0.9).toFixed(3));
      c.glyph.setAttribute('transform', 'translate(' + gx.toFixed(2) + ' ' + gy.toFixed(2) + ') rotate(' + deg + ')');
    }

    // تیک‌های کمربند: با چرخ می‌چرخند و حسِ «چرخش» را می‌دهند
    const base = g.Rb * (g.phiMax + (0.5 - pos) * g.step) - 0.7;
    sky.beltTicks.setAttribute('stroke-dashoffset', (-skyMod(base, g.beltP)).toFixed(2));
    sky.beltLayer.setAttribute('opacity', (0.35 + 0.65 * introF).toFixed(3));

    // نقطهٔ اعتدال: از مرکزِ حوت (اندیسِ ۱۲) به سمتِ مرزِ دلو (۱۱٫۵) و آن‌سوتر می‌لغزد
    if (sky.ageIdx == null) {
      const pi = ZODIAC.findIndex((c) => c.id === 'pisces'), aq = ZODIAC.findIndex((c) => c.id === 'aquarius');
      sky.ageIdx = (pi < 0 || aq < 0) ? -1 : pi + skyWrap(aq - pi, N) * 0.5 * ageProgress() * 2;
    }
    if (sky.ageIdx >= 0) {
      const ad2 = skyWrap(sky.ageIdx - pos, N);
      const phiA = ad2 * g.step;
      const o2 = skyFade(Math.abs(ad2)) * introF;
      if (o2 < 0.02) sky.ageDot.setAttribute('visibility', 'hidden');
      else {
        sky.ageDot.setAttribute('visibility', 'visible');
        sky.ageDot.setAttribute('opacity', o2.toFixed(3));
        sky.ageDot.setAttribute('transform', 'translate(' + (g.cx + g.Rb * Math.sin(phiA)).toFixed(2) + ' ' + (g.pivotY - g.Rb * Math.cos(phiA)).toFixed(2) + ')');
      }
    }

    // سه ستارهٔ لنگر: بینِ لنگرِ صورتِ فلکیِ پایین و بالا درون‌یابی می‌شوند
    const i0 = Math.floor(pos), frac = pos - i0;
    const ca = sky.cons[skyMod(i0, N)], cb = sky.cons[skyMod(i0 + 1, N)];
    const sm = frac * frac * (3 - 2 * frac);
    PRIMARY_IDS.forEach((pid) => {
      const entry = registry[pid];
      if (!entry || !entry.anchor) return;
      const key = PANEL_THEME[pid];
      const pa = skyStarWorld(ca, ca.z.anchors[key]);
      const pb = skyStarWorld(cb, cb.z.anchors[key]);
      if (!pa || !pb) return;
      entry.anchor.x = pa.x + (pb.x - pa.x) * sm;
      entry.anchor.y = pa.y + (pb.y - pa.y) * sm;
      applyOrbPosition(entry);
    });

    // کپشن: نزدیک‌ترین صورتِ فلکی؛ وسطِ چرخش محو می‌شود و متن در نقطهٔ نامرئی عوض می‌شود
    const nearest = skyMod(Math.round(pos), N);
    if (nearest !== sky.shown) { sky.shown = nearest; skyFillCaption(sky.cons[nearest].z); }
    sky.caption._parts.textWrap.style.opacity = String(skyClamp(1 - Math.abs(pos - Math.round(pos)) * 2.6, 0, 1));
  }

  // ---- حلقهٔ انیمیشن --------------------------------------------------
  function skyLoop() {
    if (!sky || sky.raf) return;
    sky.raf = requestAnimationFrame(skyTick);
  }

  function skyTick(now) {
    if (!sky) return;
    sky.raf = 0;
    let again = false;
    const tw = sky.tween;
    if (tw) {
      const p = tw.dur <= 0 ? 1 : skyClamp((now - tw.t0) / tw.dur, 0, 1);
      sky.pos = tw.from + (tw.to - tw.from) * tw.ease(p);
      if (p >= 1) {
        sky.pos = skyMod(tw.to, sky.cons.length);
        sky.tween = null;
        renderSky(now);
        skySettle();
      } else again = true;
    }
    if (sky.intro) again = true;
    if (!tw || again) renderSky(now);
    if (again) skyLoop();
  }

  function skyGoTo(target, o) {
    if (!sky) return;
    o = o || {};
    const n = sky.cons.length;
    const from = sky.pos;
    const dist = Math.abs(target - from);
    if (dist < 0.001) {
      sky.tween = null;
      sky.pos = skyMod(target, n);
      renderSky(performance.now());
      skySettle();
      return;
    }
    const idx = skyMod(Math.round(target), n);
    if (idx !== sky.soundIdx) {
      sky.soundIdx = idx;
      triggerConstellationSound('form');
    }
    const dur = reducedMotion ? 0 : (o.dur || 950) * (0.55 + 0.45 * Math.min(dist, 1));
    sky.tween = { from: from, to: target, t0: performance.now(), dur: dur, ease: o.ease || skyEaseInOut };
    skyLoop();
  }

  function skyStep(dir) {
    if (!sky || performance.now() < sky.readyAt) return;
    const base = sky.tween ? Math.round(sky.tween.to) : Math.round(sky.pos);
    skyGoTo(base + dir, { dur: 1000 });
  }

  // وقتی چرخ ایستاد: هویتِ صورتِ فلکیِ فعال + موقعیتِ لنگرها ذخیره می‌شود
  function skySettle() {
    if (!sky) return;
    const idx = skyMod(Math.round(sky.pos), sky.cons.length);
    sky.pos = idx;
    sky.settledIdx = idx;
    const z = sky.cons[idx].z;
    if (activeConstellation) activeConstellation.id = z.id;
    savedState.__lastZodiac = z.id;
    PRIMARY_IDS.forEach(function (pid) {
      const entry = registry[pid];
      if (!entry || !entry.anchor) return;
      savedState[pid] = { dissolved: true, x: entry.anchor.x, y: entry.anchor.y };
    });
    persist();
  }

  function skyClickAt(x, y) {
    if (!sky || !sky.geo) return;
    let best = null, bd = Infinity;
    sky.cons.forEach((c) => {
      if (!c.pl) return;
      const ad = Math.abs(c.d);
      if (ad < 0.6 || ad > 1.6) return;
      const dist = Math.hypot(x - c.pl.X, y - c.pl.Y);
      if (dist < bd) { bd = dist; best = c.d; }
    });
    if (best !== null && bd < sky.geo.S * 0.55) {
      skyGoTo(Math.round(sky.pos) + Math.round(best), { dur: 950 });
    }
  }

  // ---- ورودی: درگ/سوایپ، wheel افقی، کیبورد ---------------------------
  function skyBindInput() {
    const zone = sky.zone;

    zone.addEventListener('pointerdown', (e) => {
      if (!sky || performance.now() < sky.readyAt) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      sky.tween = null;
      sky.drag = {
        id: e.pointerId, x0: e.clientX, pos0: sky.pos, idx0: Math.round(sky.pos),
        moved: false, samples: [[performance.now(), e.clientX]]
      };
      try { zone.setPointerCapture(e.pointerId); } catch (err) {}
      zone.classList.add('is-dragging');
    });

    zone.addEventListener('pointermove', (e) => {
      const d = sky && sky.drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x0;
      if (!d.moved && Math.abs(dx) > 5) d.moved = true;
      if (!d.moved) return;
      sky.pos = skyClamp(d.pos0 - dx / sky.geo.S, d.idx0 - 1.15, d.idx0 + 1.15);
      d.samples.push([performance.now(), e.clientX]);
      if (d.samples.length > 8) d.samples.shift();
      skyLoop();
    });

    const finish = (e, cancelled) => {
      const d = sky && sky.drag;
      if (!d || e.pointerId !== d.id) return;
      sky.drag = null;
      zone.classList.remove('is-dragging');
      try { zone.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!d.moved) { if (!cancelled) skyClickAt(e.clientX, e.clientY); return; }
      let v = 0; // واحد: اندیس بر میلی‌ثانیه
      const sm = d.samples;
      if (sm.length >= 2) {
        const a = sm[0], b = sm[sm.length - 1], dt = b[0] - a[0];
        if (dt > 0 && performance.now() - b[0] < 120) v = -(b[1] - a[1]) / sky.geo.S / dt;
      }
      const proj = cancelled ? sky.pos : sky.pos + v * 260;
      const target = skyClamp(Math.round(proj), d.idx0 - 1, d.idx0 + 1);
      skyGoTo(target, { ease: skyEaseOut, dur: 750 });
    };
    zone.addEventListener('pointerup', (e) => finish(e, false));
    zone.addEventListener('pointercancel', (e) => finish(e, true));

    zone.addEventListener('wheel', (e) => {
      if (!sky || performance.now() < sky.readyAt) return;
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
      if (!dx) return;
      e.preventDefault();
      const now = performance.now();
      if (now - sky.lastWheel > 220) sky.wheelAcc = 0;
      sky.lastWheel = now;
      sky.wheelAcc += dx;
      if (now < sky.wheelLock) return;
      if (Math.abs(sky.wheelAcc) > 45) {
        skyStep(sky.wheelAcc > 0 ? 1 : -1);
        sky.wheelAcc = 0;
        sky.wheelLock = now + 520;
      }
    }, { passive: false });

    sky.onKey = (e) => {
      if (!sky || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.body.classList.contains('void-music-on')) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target, tag = t && t.tagName;
      if (t && (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return;
      e.preventDefault();
      skyStep(e.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', sky.onKey);
  }

  function skyTeardown() {
    if (!sky) return;
    if (sky.raf) { try { cancelAnimationFrame(sky.raf); } catch (e) {} }
    try { document.removeEventListener('keydown', sky.onKey); } catch (e) {}
    sky = null;
  }

  // ---- ساختِ آسمان ------------------------------------------------------
  function buildSky(startZ, opts) {
    opts = opts || {};
    clearConstellation();
    const N = ZODIAC.length;
    const startIdx = Math.max(0, ZODIAC.findIndex((c) => c.id === startZ.id));
    const now = performance.now();
    const intro = !!opts.intro && !reducedMotion;

    const layerEl = document.createElement('div');
    layerEl.className = 'ai-void-constellation' + (intro ? ' is-forming' : '');
    layerEl.setAttribute('role', 'group');
    layerEl.setAttribute('aria-label', 'Zodiac');

    const zone = document.createElement('div');
    zone.className = 'ai-void-sky-zone';

    const svg = skyEl('svg', null, 'ai-void-sky');
    const defs = skyEl('defs');
    const halo = skyEl('radialGradient', { id: 'zsHalo' });
    halo.append(
      skyEl('stop', { offset: '0%', 'stop-color': '#c7d2fe', 'stop-opacity': '0.55' }),
      skyEl('stop', { offset: '100%', 'stop-color': '#818cf8', 'stop-opacity': '0' })
    );
    const beltGrad = skyEl('linearGradient', { id: 'zsBelt', gradientUnits: 'userSpaceOnUse', x1: '0', y1: '0', x2: '1', y2: '0' });
    beltGrad.append(
      skyEl('stop', { offset: '0%', 'stop-color': '#c7d2fe', 'stop-opacity': '0' }),
      skyEl('stop', { offset: '30%', 'stop-color': '#c7d2fe', 'stop-opacity': '0.34' }),
      skyEl('stop', { offset: '50%', 'stop-color': '#e0e7ff', 'stop-opacity': '0.6' }),
      skyEl('stop', { offset: '70%', 'stop-color': '#c7d2fe', 'stop-opacity': '0.34' }),
      skyEl('stop', { offset: '100%', 'stop-color': '#c7d2fe', 'stop-opacity': '0' })
    );
    defs.append(halo, beltGrad);
    svg.appendChild(defs);

    const beltLayer = skyEl('g', null, 'zs-belt');
    const beltLine = skyEl('path', null, 'zs-belt-line');
    const beltTicks = skyEl('path', null, 'zs-belt-ticks');
    beltLayer.append(beltLine, beltTicks);
    svg.appendChild(beltLayer);

    // نقطهٔ اعتدالِ بهاری: نقطهٔ طلاییِ کوچک رویِ کمان، بینِ حوت و دلو
    const ageDot = skyEl('g', { visibility: 'hidden' }, 'zs-age');
    ageDot.append(skyEl('circle', { r: '7' }, 'zs-age-ring'), skyEl('circle', { r: '2.6' }, 'zs-age-core'));
    beltLayer.appendChild(ageDot);

    const consLayer = skyEl('g', null, 'zs-cons');
    const glyphLayer = skyEl('g', null, 'zs-glyphs');
    const cons = ZODIAC.map((z) => {
      const g = skyEl('g', { 'data-id': z.id, visibility: 'hidden' }, 'zs-con');
      const sm = Object.create(null);
      const stars = (z.stars || []).map((s, j) => {
        const st = { id: s.id, x: s.x, y: s.y, mag: typeof s.mag === 'number' ? s.mag : 0.5, lx: 0, ly: 0 };
        st.halo = skyEl('circle', null, 'zs-halo');
        st.core = skyEl('circle', null, 'zs-core' + (s.role === 'anchor' ? '' : ' is-helper'));
        st.core.style.setProperty('--tw', (-Math.random() * 5).toFixed(2) + 's');
        sm[s.id] = st;
        return st;
      });
      const edges = [];
      (z.edges || []).forEach((pair, j) => {
        const a = sm[pair[0]], b = sm[pair[1]];
        if (!a || !b) return;
        const el = skyEl('line', { pathLength: '1' }, 'zs-edge');
        el.style.setProperty('--i', String(j));
        edges.push({ el: el, a: a, b: b });
      });
      edges.forEach((e) => g.appendChild(e.el));
      stars.forEach((s) => g.appendChild(s.halo));
      stars.forEach((s) => g.appendChild(s.core));
      consLayer.appendChild(g);

      const glyph = skyEl('text', { visibility: 'hidden' }, 'zs-glyph');
      glyph.textContent = (SKY_GLYPH[z.id] || '\u2605') + '\uFE0E';
      glyphLayer.appendChild(glyph);

      let hx = 0, hy = 0;
      stars.forEach((s) => { hx = Math.max(hx, Math.abs(s.x)); hy = Math.max(hy, Math.abs(s.y)); });
      return { z: z, g: g, glyph: glyph, edges: edges, stars: stars, sm: sm, hx: hx, hy: hy, u: 1, d: 0, pl: null, vis: false, near: false };
    });
    svg.append(consLayer, glyphLayer);

    const caption = buildCaptionBlock();
    layerEl.append(zone, svg, caption);
    document.body.appendChild(layerEl);
    constellationLayer = layerEl;

    const thisSky = sky = {
      layer: layerEl, zone: zone, svg: svg, caption: caption,
      beltLayer: beltLayer, ageDot: ageDot, beltLine: beltLine, beltTicks: beltTicks, beltGrad: beltGrad,
      cons: cons, geo: null, layoutKey: '',
      pos: startIdx, settledIdx: startIdx, soundIdx: startIdx, shown: -1,
      tween: null, drag: null, raf: 0,
      intro: intro, introStart: now, introEnd: intro ? now + SKY_INTRO_MS : 0,
      readyAt: intro ? now + 1000 : 0,
      wheelAcc: 0, lastWheel: 0, wheelLock: 0, onKey: null
    };

    // لنگرها: در ورودِ زنده با CSS به جایگاه می‌لغزند؛ بعدش فقط JS هر فریم جابه‌جایشان می‌کند
    PRIMARY_IDS.forEach((pid) => {
      const entry = registry[pid];
      if (!entry || !entry.singularity) return;
      entry.singularity.classList.add('is-constellation');
      entry.singularity.style.transition = intro
        ? 'left 0.95s cubic-bezier(.2,.8,.2,1), top 0.95s cubic-bezier(.2,.8,.2,1), opacity 0.35s ease, transform 0.4s cubic-bezier(.2,.9,.2,1)'
        : '';
    });
    if (intro) {
      setTimeout(() => {
        if (sky !== thisSky) return;
        PRIMARY_IDS.forEach((pid) => {
          const entry = registry[pid];
          if (entry && entry.singularity) entry.singularity.style.transition = '';
        });
        try { layerEl.classList.remove('is-forming'); } catch (e) {}
      }, SKY_INTRO_MS + 700);
    }

    layoutSky();
    renderSky(now);
    skyBindInput();
    requestAnimationFrame(() => { if (sky === thisSky) layerEl.classList.add('is-visible'); });
    if (intro) skyLoop();

    const g = sky.geo;
    activeConstellation = { id: ZODIAC[startIdx].id, centerX: g.cx, centerY: g.cy, scale: g.W };
    savedState.__lastZodiac = ZODIAC[startIdx].id;
    PRIMARY_IDS.forEach(function (pid) {
      const entry = registry[pid];
      if (!entry || !entry.anchor) return;
      savedState[pid] = { dissolved: true, x: entry.anchor.x, y: entry.anchor.y };
    });
    persist();
  }


  function rand(a, b) { return a + Math.random() * (b - a); }

  function organicOffset() {
    const r = rand(OFFSET_RADIUS_MIN, OFFSET_RADIUS_MAX);
    const a = Math.random() * Math.PI * 2;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
  }

  function particleBurst(rect, inward) {
    if (reducedMotion) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = document.createElement('span');
      p.className = 'ai-void-dust' + (inward ? ' is-inward' : '');
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4;
      const dist = 40 + Math.random() * Math.max(rect.width, rect.height) * 0.55;
      const size = 2 + Math.random() * 3.5;
      const hue = 200 + Math.random() * 80;
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      p.style.setProperty('--sz', size + 'px');
      p.style.setProperty('--hue', String(hue));
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      layer.appendChild(p);
      setTimeout(() => { try { p.remove(); } catch (e) {} }, DISSOLVE_MS + 80);
    }
  }

  function applyOrbPosition(entry) {
    if (!entry || !entry.singularity || !entry.anchor) return;
    const x = Math.max(12, Math.min(window.innerWidth - 44, entry.anchor.x - 18));
    const y = Math.max(12, Math.min(window.innerHeight - 44, entry.anchor.y - 18));
    entry.singularity.style.left = x + 'px';
    entry.singularity.style.top = y + 'px';
  }

  function countDissolvedPrimaries() {
    // Prefer persisted flags so a fresh tab can reform the constellation
    // even before every singularity DOM node is rebuilt.
    var fromState = PRIMARY_IDS.filter(function (id) {
      return savedState[id] && savedState[id].dissolved;
    }).length;
    if (fromState > 0) return fromState;
    return PRIMARY_IDS.filter(function (id) {
      var e = registry[id];
      return e && e.singularity;
    }).length;
  }

  function clearConstellation() {
    skyTeardown();
    if (constellationLayer) {
      try { constellationLayer.remove(); } catch (e) {}
      constellationLayer = null;
    }
    activeConstellation = null;
    PRIMARY_IDS.forEach((id) => {
      const e = registry[id];
      if (e && e.singularity) applyOrbPosition(e);
    });
  }

  // ---------------------------------------------------------------------
  // **نظارت پویا روی ارتفاع واقعی ردیف لینک‌های پرکاربرد**
  // وقتی ارتفاع تغییر کرد، صور فلکی فوراً recalculate می‌شود.
  // این observer فقط یک‌بار (سطح ماژول) ساخته می‌شود — قبلاً داخل
  // clearConstellation() ساخته می‌شد که هر بار صدا زده می‌شد (هر dissolve/
  // restore) یک ResizeObserver تازه روی همون المان می‌ساخت و قبلی‌ها هیچ‌وقت
  // disconnect نمی‌شدند: نشتِ نامحدودِ observer که با هر resize، تعدادِ
  // رو‌به‌رشدی از rebuild/storage-write تکراری اجرا می‌کرد.
  // ---------------------------------------------------------------------
  let topsitesObserver = null;
  function ensureTopsitesObserver() {
    if (topsitesObserver) return;
    const topsitesContainer = document.getElementById('ai-ntp-topsites');
    if (!topsitesContainer) return;
    topsitesObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        repositionForLayoutChange();
      });
    });
    topsitesObserver.observe(topsitesContainer);
  }

  function pickConstellation() {
    if (!ZODIAC.length) return null;
    // Avoid repeating the last one if possible
    let pool = ZODIAC;
    if (savedState.__lastZodiac && ZODIAC.length > 1) {
      pool = ZODIAC.filter((z) => z.id !== savedState.__lastZodiac);
      if (!pool.length) pool = ZODIAC;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function starMap(z) {
    const m = Object.create(null);
    (z.stars || []).forEach((s) => { m[s.id] = s; });
    return m;
  }


  /**
   * Constellation placement — stage-relative spatial system (not viewport thirds).
   *
   * Horizontal: ± stage.width/6 from stage mid (LTR left, RTL right)
   * Vertical:   topsites.bottom (or stage.bottom if hidden) + 10px gap,
   *             using real star bounds.minY so any zodiac figure sits tangent
   * Scale:      viewport-adaptive from nominal z.scale (clamped ~56..90)
   *
   * Returns { cx, cy, scale } — callers must use the returned scale.
   */
  function constellationStarBounds(z) {
    var minY = 0, maxY = 0, minX = 0, maxX = 0, first = true;
    (z && z.stars || []).forEach(function (s) {
      var x = typeof s.x === 'number' ? s.x : 0;
      var y = typeof s.y === 'number' ? s.y : 0;
      if (first) { minX = maxX = x; minY = maxY = y; first = false; }
      else {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    });
    if (first) { minY = -1; maxY = 1; minX = -1; maxX = 1; }
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }



  function formConstellation() {
    if (countDissolvedPrimaries() < 3) return;
    const z = pickConstellation();
    if (!z) return;
    buildSky(z, { intro: true });
  }

  // سازگاری با فراخوانی‌های قدیمی؛ حالا همه‌چیز از buildSky می‌گذرد.
  function formConstellationFrom(z, cx, cy, forcedScale, withSound) {
    if (countDissolvedPrimaries() < 3 || !z) return;
    buildSky(z, { intro: withSound !== false });
  }

  function placeSingularity(entry, rect) {
    removeSingularity(entry);
    const theme = PANEL_THEME[entry.id] || 'today';
    const orb = document.createElement('button');
    orb.type = 'button';
    orb.className = 'ai-void-singularity theme-' + theme;
    orb.dataset.voidId = entry.id;
    orb.setAttribute('aria-label', labelText(entry));
    orb.title = labelText(entry);

    const x = entry.anchor && typeof entry.anchor.x === 'number'
      ? entry.anchor.x
      : (rect.left + rect.width / 2);
    const y = entry.anchor && typeof entry.anchor.y === 'number'
      ? entry.anchor.y
      : (rect.top + rect.height / 2);

    if (!entry.anchor) {
      entry.anchor = { x: x, y: y, preferredX: x, preferredY: y };
    } else {
      entry.anchor.x = x;
      entry.anchor.y = y;
      if (entry.anchor.preferredX == null) entry.anchor.preferredX = x;
      if (entry.anchor.preferredY == null) entry.anchor.preferredY = y;
    }

    const glow = document.createElement('span');
    glow.className = 'ai-void-singularity-glow';
    const ring = document.createElement('span');
    ring.className = 'ai-void-singularity-ring';
    const core = document.createElement('span');
    core.className = 'ai-void-singularity-core';
    const glyph = document.createElement('span');
    glyph.className = 'ai-void-singularity-glyph';
    glyph.textContent = '◉';
    orb.append(glow, ring, core, glyph);

    orb.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      restore(entry.id);
    });
    orb.addEventListener('pointerenter', () => orb.classList.add('is-awake'));
    orb.addEventListener('pointerleave', () => orb.classList.remove('is-awake'));

    document.body.appendChild(orb);
    entry.singularity = orb;
    applyOrbPosition(entry);
    requestAnimationFrame(() => orb.classList.add('is-visible'));
  }

  function removeSingularity(entry) {
    if (entry.singularity) {
      try { entry.singularity.remove(); } catch (e) {}
      entry.singularity = null;
    }
  }


  function triggerMeteorBurst() {
    try {
      if (window.VoidStarfield && typeof window.VoidStarfield.unlockAudio === 'function') {
        window.VoidStarfield.unlockAudio();
      }
      if (window.VoidStarfield && typeof window.VoidStarfield.triggerMeteor === 'function') {
        window.VoidStarfield.triggerMeteor(reducedMotion ? 1 : 2);
      }
    } catch (e) {}
  }

  function triggerConstellationSound(mode, opts) {
    try {
      if (!window.VoidStarfield) return;
      if (typeof window.VoidStarfield.unlockAudio === 'function') {
        window.VoidStarfield.unlockAudio();
      }
      if (mode === 'break') {
        if (typeof window.VoidStarfield.playConstellationBreak === 'function') {
          window.VoidStarfield.playConstellationBreak();
        } else if (typeof window.VoidStarfield.playConstellationFormation === 'function') {
          window.VoidStarfield.playConstellationFormation('break');
        }
      } else if (typeof window.VoidStarfield.playConstellationFormation === 'function') {
        // IMPORTANT: call the starfield API — never recurse into this helper
        window.VoidStarfield.playConstellationFormation('form', opts || {});
      }
    } catch (e) {
      try { console.warn('[void] constellation sound error', e); } catch (e2) {}
    }
  }

  function commitFormation(source) {
    try {
      console.log('[void] commitFormation', source, 'dissolved=', countDissolvedPrimaries());
    } catch (e) {}
    triggerConstellationSound('form');
    try {
      if (countDissolvedPrimaries() >= 3) formConstellation();
    } catch (e) {}
  }

  function dissolve(id) {
    const entry = registry[id];
    if (!entry || !entry.el || entry.dissolving) return;
    if (entry.singularity || entry.el.classList.contains('ai-void-is-dissolved')) return;

    entry.dissolving = true;
    const rect = entry.el.getBoundingClientRect();
    // Frozen center of gravity + organic jitter (panel restores to original layout slot)
    const ax = rect.left + rect.width / 2;
    const ay = rect.top + rect.height / 2;
    const off = organicOffset();
    entry.anchor = {
      x: ax + off.dx,
      y: ay + off.dy,
      preferredX: ax + off.dx,
      preferredY: ay + off.dy
    };

    entry.el.classList.add('ai-void-is-dissolving');
    particleBurst(rect, false);
    triggerMeteorBurst();

    const finish = () => {
      entry.el.classList.remove('ai-void-is-dissolving');
      entry.el.hidden = false;
      entry.el.classList.add('ai-void-is-dissolved');
      entry.el.setAttribute('aria-hidden', 'true');
      entry.dissolving = false;
      placeSingularity(entry, rect);
      savedState[id] = {
        dissolved: true,
        x: entry.anchor.x,
        y: entry.anchor.y
      };
      persist();
      if (typeof entry.onHide === 'function') {
        try { entry.onHide(); } catch (e) {}
      }
      // Third primary completes a zodiac figure
      if (countDissolvedPrimaries() >= 3) {
        try { console.log('[void] third finish, dissolved=', countDissolvedPrimaries()); } catch (e) {}
        // Double rAF keeps us near the unlock gesture; audio graph uses internal clock for lock @0.45s
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            commitFormation('dissolve');
          });
        });
      }
    };

    if (reducedMotion) finish();
    else setTimeout(finish, DISSOLVE_MS);
  }

  function restore(id) {
    const entry = registry[id];
    if (!entry || !entry.el || entry.dissolving) return;

    entry.dissolving = true;
    const wasConstellation = !!activeConstellation;
    if (wasConstellation) {
      clearConstellation();
    }
    // Break sound only when this restore is the last dissolved primary (full return to normal)
    const otherDissolved = PRIMARY_IDS.filter(function (pid) {
      return pid !== id && savedState[pid] && savedState[pid].dissolved;
    }).length;
    const isLastReturn = !!(savedState[id] && savedState[id].dissolved) && otherDissolved === 0;
    if (isLastReturn) {
      triggerConstellationSound('break');
    }

    const orb = entry.singularity;
    let rect = {
      left: entry.anchor ? entry.anchor.x - 40 : window.innerWidth / 2,
      top: entry.anchor ? entry.anchor.y - 20 : 80,
      width: 80,
      height: 40
    };
    if (orb) {
      const r = orb.getBoundingClientRect();
      rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      orb.classList.add('is-collapsing');
    }
    particleBurst(rect, true);
    triggerMeteorBurst();

    const finish = () => {
      removeSingularity(entry);
      entry.el.hidden = false;
      entry.el.removeAttribute('hidden');
      entry.el.classList.remove('ai-void-is-dissolved');
      try { delete entry.el.dataset.voidBootDissolved; } catch (e) {}
      entry.el.setAttribute('aria-hidden', 'false');
      entry.el.classList.add('ai-void-is-reforming');
      entry.dissolving = false;
      delete savedState[id];
      // Drop constellation meta once any primary returns
      if (savedState.__constellation) delete savedState.__constellation;
      persist();
      if (typeof entry.onShow === 'function') {
        try { entry.onShow(); } catch (e) {}
      }
      // Remaining primaries return toward their preferred CoG
      PRIMARY_IDS.forEach((pid) => {
        if (pid === id) return;
        const e = registry[pid];
        if (!e || !e.singularity || !e.anchor) return;
        if (e.anchor.preferredX != null) e.anchor.x = e.anchor.preferredX;
        if (e.anchor.preferredY != null) e.anchor.y = e.anchor.preferredY;
        e.singularity.classList.remove('is-constellation');
        e.singularity.style.transition = reducedMotion
          ? 'none'
          : 'left 0.55s cubic-bezier(.2,.8,.2,1), top 0.55s cubic-bezier(.2,.8,.2,1)';
        applyOrbPosition(e);
      });
      setTimeout(() => {
        try { entry.el.classList.remove('ai-void-is-reforming'); } catch (e) {}
      }, RESTORE_MS);
    };

    if (reducedMotion) finish();
    else setTimeout(finish, Math.min(RESTORE_MS, 420));
  }

  function isDissolved(id) {
    return !!(savedState[id] && savedState[id].dissolved);
  }

  function register(id, opts) {
    if (!opts || !opts.el) return;
    const entry = {
      id: id,
      el: opts.el,
      label: opts.label || id,
      onHide: opts.onHide,
      onShow: opts.onShow,
      singularity: null,
      anchor: null,
      dissolving: false
    };
    registry[id] = entry;

    if (opts.trigger) {
      opts.trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dissolve(id);
      });
    }

    const applySaved = () => {
      if (savedState[id] && savedState[id].dissolved) {
        const sx = savedState[id].x || 40;
        const sy = savedState[id].y || 80;
        entry.anchor = { x: sx, y: sy, preferredX: sx, preferredY: sy };
        // Router may already have hidden the panel (voidBootDissolved) so the
        // first paint never showed the collapsed Today dock. Do not force
        // hidden=false on the side panel — that was the flash source.
        if (id === 'todo') {
          entry.el.hidden = true;
        } else {
          entry.el.hidden = false;
        }
        entry.el.classList.add('ai-void-is-dissolved');
        entry.el.setAttribute('aria-hidden', 'true');
        try { delete entry.el.dataset.voidBootDissolved; } catch (e) {}
        placeSingularity(entry, {
          left: entry.anchor.x - 20,
          top: entry.anchor.y - 20,
          width: 40,
          height: 40
        });
        if (typeof entry.onHide === 'function') {
          try { entry.onHide({ fromStorage: true }); } catch (e) {}
        }
      }
      // آسمان را بعد از باز شدنِ تب دوباره می‌سازد (فقط هویت ذخیره می‌شود، هندسه از چیدمانِ زنده).
      if (countDissolvedPrimaries() >= 3 && savedState.__constellation && !hydrateScheduled) {
        hydrateScheduled = true;
        requestAnimationFrame(() => {
          hydrateScheduled = false;
          if (sky) return;
          const z = ZODIAC.find((c) => savedState.__constellation && c.id === savedState.__constellation.id)
            || pickConstellation();
          if (z) buildSky(z, { intro: false });
        });
      }
    };
    if (stateLoaded) applySaved();
    else loadState(applySaved);
  }


  // منطقِ مشترکِ سه‌جا: هر وقت چیدمانِ صفحه به شکلی تغییر کند که ممکن است
  // لنگرگاهِ صورتِ فلکی/تک‌ستاره‌ها (پایینِ لینک‌های پرکاربرد) عوض شده
  // باشد — تغییرِ سایزِ پنجره، اسکرولِ Stage روی موبایل، یا رندرِ دوبارهٔ
  // خودِ ردیفِ لینک‌های پرکاربرد (که async است و ارتفاعش می‌تواند بعد از
  // تشکیلِ اولیهٔ صورتِ فلکی عوض شود) — همین یک تابع صدا زده می‌شود.
  function repositionForLayoutChange() {
    /* Panel heads can move when Today changes side/height, Echo or Goals
       expands, or the window crosses a responsive breakpoint. Keep every
       dissolved marker tied to its live panel center, not its old viewport
       coordinates; otherwise the dots overlap after a resize. */
    if (!sky) {
      PRIMARY_IDS.forEach((id) => {
        const entry = registry[id];
        if (!entry || !entry.singularity || !entry.el || entry.el.hidden) return;
        const rect = entry.el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        entry.anchor = entry.anchor || {};
        entry.anchor.x = rect.left + rect.width / 2;
        entry.anchor.y = rect.top + rect.height / 2;
        if (entry.anchor.preferredX == null) entry.anchor.preferredX = entry.anchor.x;
        if (entry.anchor.preferredY == null) entry.anchor.preferredY = entry.anchor.y;
      });
    }
    if (sky && countDissolvedPrimaries() >= 3) {
      layoutSky();
      renderSky(performance.now());
      if (activeConstellation && sky.geo) {
        activeConstellation.centerX = sky.geo.cx;
        activeConstellation.centerY = sky.geo.cy;
        activeConstellation.scale = sky.geo.W;
      }
    } else {
      PRIMARY_IDS.forEach((id) => {
        const e = registry[id];
        if (e && e.singularity) applyOrbPosition(e);
      });
    }
  }

  let _resizeTimer = null;
  let _lastResizeW = window.innerWidth;
  let _lastResizeH = window.innerHeight;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      const dw = Math.abs(window.innerWidth - _lastResizeW);
      const dh = Math.abs(window.innerHeight - _lastResizeH);
      // Ignore sub-pixel / tiny jitter while dragging a window edge
      if (dw < 8 && dh < 8) return;
      _lastResizeW = window.innerWidth;
      _lastResizeH = window.innerHeight;
      repositionForLayoutChange();
    }, 120);
  }, { passive: true });

  /* A resized dock, a collapsed/expanded Echo or Goals panel, and the
     mobile Stage scroll all alter the anchors without necessarily firing a
     window resize or changing the frequent-links row. Observe the actual
     primary panels so all three markers stay in sync in every mode. */
  try {
    const layoutObserver = new ResizeObserver(() => {
      requestAnimationFrame(repositionForLayoutChange);
    });
    ['ai-void-todo-dock', 'ai-void-echo', 'ai-void-agenda-goals-section', 'ai-void-stage']
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el) layoutObserver.observe(el);
      });
  } catch (e) {}

  window.addEventListener('void-panel-layout-changed', repositionForLayoutChange, { passive: true });

  // موبایل: از وقتی #ai-void-stage به‌جای یک چیدمانِ ثابت، یک ستونِ
  // اسکرول‌شونده شده (زیرِ ۹۴۰px)، اگه کاربر بعد از تشکیلِ صورتِ فلکی
  // استیج را اسکرول کند، صورتِ فلکی (که position:fixed است، یعنی نسبت به
  // ویوپورت ثابت می‌ماند) دیگر با لینک‌های پرکاربرد (که داخلِ همون استیجِ
  // اسکرول‌شونده جابه‌جا می‌شوند) هم‌راستا نمی‌ماند و ممکن است رویشان
  // بیفتد.
  let _stageScrollTimer = null;
  try {
    const stageEl = document.getElementById('ai-void-stage');
    if (stageEl) {
      stageEl.addEventListener('scroll', () => {
        clearTimeout(_stageScrollTimer);
        _stageScrollTimer = setTimeout(repositionForLayoutChange, 80);
      }, { passive: true });
    }
  } catch (e) {}

  // این یکی علتِ واقعیِ اسکرین‌شات‌ها بود: void-tab-topsites.js ردیفِ
  // لینک‌های پرکاربرد را async و چندبار می‌سازد — اول با pinnedِ خالی، بعد
  // (چند میلی‌ثانیه دیرتر، وقتی chrome.topSites.get جواب می‌دهد) با
  // آیکون‌های واقعی که ارتفاعِ ردیف را عوض می‌کنند. اگر صورتِ فلکی دقیقاً
  // در همان فاصله (قبل از رسیدنِ آیکون‌های واقعی) تشکیل شده باشد،
  // anchorBottomِ خودش را از رویِ یک ردیفِ هنوز-کامل-نشده حساب کرده و
  // دیگر هیچ‌وقت (نه با resize نه با scroll) خودش را تصحیح نمی‌کند — چون
  // هیچ‌کدام از آن دو رویداد واقعاً فایر نمی‌شوند. void-tab-topsites.js
  // بعد از هر render یک رویدادِ 'void-topsites-rendered' می‌فرستد؛ همین‌جا
  // با آن گوش می‌دهیم و اگر صورتِ فلکی از قبل تشکیل شده، دوباره با
  // ارتفاعِ واقعیِ تازه هماهنگش می‌کنیم.
  window.addEventListener('void-topsites-rendered', () => {
    repositionForLayoutChange();
  }, { passive: true });

  loadState();
  ensureTopsitesObserver();

  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.appLanguage) {
        try {
          if (typeof currentLang !== 'undefined') {
            currentLang = changes.appLanguage.newValue || 'en';
          }
        } catch (e) {}
        refreshConstellationCaption();
        // Update singularity tooltips
        Object.keys(registry).forEach((id) => {
          const e = registry[id];
          if (e && e.singularity) {
            const txt = labelText(e);
            e.singularity.title = txt;
            e.singularity.setAttribute('aria-label', txt);
          }
        });
      }
    });
  } catch (e) {}

  window.VoidDissolve = {
    register: register,
    dissolve: dissolve,
    restore: restore,
    isDissolved: isDissolved,
    // بدونِ این، applyDockVisibility (توی void-tab-todo.js) هیچ راهی نداره
    // بفهمه که isDissolved('todo') هنوز از savedState خالیِ اولیه جواب
    // می‌ده (چون loadState هنوز از chrome.storage برنگشته)، نه از دادهٔ
    // واقعی — دقیقاً همون چیزی که باعثِ فلشِ Today می‌شه.
    isReady: function () { return stateLoaded; },
    // فقط‌خواندنی، برایِ بخشِ مستقلِ «آسمان زودیاک» (void-tab-zodiac.js):
    // همان دادهٔ مرکزی و همان صورتِ فلکیِ فعلاً شکل‌گرفته، بدونِ دست‌زدن به
    // چرخهٔ dissolve/formation.
    getZodiac: function () { return ZODIAC; },
    getActiveConstellationId: function () { return activeConstellation ? activeConstellation.id : null; },
    // چرخاندنِ دستیِ چرخِ زودیاک از بیرون (dir = +1 بعدی، -1 قبلی)
    rotateZodiac: function (dir) { skyStep(dir < 0 ? -1 : 1); }
  };
})();
