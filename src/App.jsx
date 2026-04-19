// Health AI Diet App — single JSX file, CDN React + Tailwind, no build step
const { useState, useEffect, useCallback } = React;

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE = {
  goal: 'Cut',
  weight: 185,
  bmr: 1688,
  bodyFat: 27.4,
  muscleMass: 127.8,
  foodPreferences: 'Mediterranean, Latin-influenced',
};

// ── Utilities ────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

const weekDates = () => {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
};

const isSunday = () => new Date().getDay() === 0;

const ls = {
  get: (k, def = null) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

// ── HealthKit bridge ─────────────────────────────────────────────────────────

const tryHealthKit = () =>
  new Promise(resolve => {
    if (!window.webkit?.messageHandlers?.healthKit) { resolve(null); return; }
    window.healthKitCallback = resolve;
    window.webkit.messageHandlers.healthKit.postMessage({ action: 'readData' });
    setTimeout(() => resolve(null), 3000);
  });

// ── Sparkline ────────────────────────────────────────────────────────────────

const Sparkline = ({ data = [], color = '#22c55e', width = 110, height = 36 }) => {
  const valid = data.filter(v => v > 0);
  if (valid.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lx, ly] = pts[pts.length - 1].split(',');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="3" fill={color} />
    </svg>
  );
};

// ── MacroBadge ───────────────────────────────────────────────────────────────

const MacroBadge = ({ label, value, color }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
    {label} {value}
  </span>
);

// ── MealCard ─────────────────────────────────────────────────────────────────

const MEAL_META = [
  { label: 'Breakfast Anchor', icon: '☀️', border: 'border-green-500' },
  { label: 'Lunch Target',     icon: '🌤',  border: 'border-blue-500' },
  { label: 'Dinner Constraint',icon: '🌙',  border: 'border-purple-500' },
];

const MealCard = ({ meal, index }) => {
  const { label, icon, border } = MEAL_META[index] || MEAL_META[0];
  return (
    <div className={`bg-gray-900 rounded-2xl p-4 border-l-4 ${border} mb-3`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
          {icon} {label}
        </span>
        <span className="text-green-400 font-bold text-sm">{meal.calories} kcal</span>
      </div>
      <h3 className="text-white font-semibold text-base mb-1">{meal.name}</h3>
      <p className="text-gray-400 text-xs mb-3 leading-relaxed">{meal.rationale}</p>
      <div className="flex flex-wrap gap-2">
        <MacroBadge label="P" value={meal.protein + 'g'} color="bg-green-900 text-green-300" />
        <MacroBadge label="C" value={meal.carbs + 'g'}   color="bg-blue-900 text-blue-300" />
        <MacroBadge label="F" value={meal.fat + 'g'}     color="bg-yellow-900 text-yellow-300" />
      </div>
    </div>
  );
};

// ── ManualHealthEntry ────────────────────────────────────────────────────────

const WORKOUT_TYPES = ['None', 'Strength', 'Endurance', 'HIIT', 'Yoga', 'Recovery'];

const ManualHealthEntry = ({ onSubmit, initialData = {} }) => {
  const [form, setForm] = useState({
    activeCalories: initialData.activeCalories || '',
    hrv:            initialData.hrv || '',
    sleepHours:     initialData.sleepHours || '',
    steps:          initialData.steps || '',
    restingHR:      initialData.restingHR || '',
    workoutMinutes: initialData.workoutMinutes || '',
    workoutType:    initialData.workoutType || 'None',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const FIELDS = [
    { k: 'activeCalories', label: 'Active Cal', ph: 'kcal' },
    { k: 'hrv',            label: 'HRV',        ph: 'ms'   },
    { k: 'sleepHours',     label: 'Sleep',      ph: 'hrs'  },
    { k: 'steps',          label: 'Steps',      ph: '8000' },
    { k: 'restingHR',      label: 'Resting HR', ph: 'bpm'  },
    { k: 'workoutMinutes', label: 'Workout Min',ph: 'min'  },
  ];
  return (
    <div className="bg-gray-900 rounded-2xl p-4 mb-4">
      <h3 className="text-white font-semibold mb-3 text-sm">Today's Health Data</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {FIELDS.map(({ k, label, ph }) => (
          <div key={k}>
            <label className="text-gray-500 text-xs mb-1 block">{label}</label>
            <input type="number" value={form[k]} placeholder={ph}
              onChange={e => set(k, e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-green-500 outline-none" />
          </div>
        ))}
      </div>
      <div className="mb-4">
        <label className="text-gray-500 text-xs mb-2 block">Workout Type</label>
        <div className="flex flex-wrap gap-2">
          {WORKOUT_TYPES.map(t => (
            <button key={t} onClick={() => set('workoutType', t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                form.workoutType === t ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => onSubmit(form)}
        className="w-full bg-green-500 text-black font-bold py-3 rounded-xl text-sm">
        Generate Suggestions
      </button>
    </div>
  );
};

// ── TodayView ────────────────────────────────────────────────────────────────

const TodayView = ({ suggestions, loading, streamingText, error, healthData, onGenerate, onReset }) => {
  const [showManual, setShowManual] = useState(!healthData);
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Today's Plan</h1>
          <p className="text-gray-500 text-sm">{dateLabel}</p>
        </div>
        {isSunday() && (
          <span className="bg-purple-900 text-purple-300 text-xs px-2 py-1 rounded-full font-semibold">
            Week Summary
          </span>
        )}
      </div>

      {!suggestions && !loading && (
        <>
          {!showManual && healthData ? (
            <div className="bg-gray-900 rounded-2xl p-4 mb-4">
              <p className="text-gray-400 text-sm mb-3">HealthKit data loaded.</p>
              <button onClick={() => onGenerate(healthData)}
                className="w-full bg-green-500 text-black font-bold py-3 rounded-xl text-sm mb-2">
                Generate Suggestions
              </button>
              <button onClick={() => setShowManual(true)}
                className="w-full text-gray-500 text-xs py-1">
                Enter data manually instead
              </button>
            </div>
          ) : (
            <ManualHealthEntry onSubmit={onGenerate} initialData={healthData} />
          )}
        </>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Analyzing your data…</p>
          {streamingText && (
            <p className="text-gray-600 text-xs text-center px-6 max-w-xs">
              {streamingText.length > 80 ? streamingText.slice(-80) : streamingText}
            </p>
          )}
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-900/30 border border-red-800 rounded-2xl p-4 mb-4">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button onClick={() => setShowManual(true)}
            className="text-green-400 text-xs underline">
            Try manual entry
          </button>
        </div>
      )}

      {suggestions && !loading && (
        <>
          <div className="bg-gray-900 rounded-2xl p-4 mb-3">
            <p className="text-gray-300 text-sm leading-relaxed mb-3">{suggestions.summary}</p>
            <div className="flex gap-4">
              {[
                { val: suggestions.tdee,          label: 'TDEE',   color: 'text-blue-400'  },
                { val: suggestions.targetCalories, label: 'Target', color: 'text-green-400' },
                { val: suggestions.deficit,        label: 'Deficit',color: 'text-yellow-400'},
              ].map(({ val, label, color }) => (
                <div key={label} className="text-center">
                  <div className={`font-bold ${color}`}>{val}</div>
                  <div className="text-gray-500 text-xs">{label}</div>
                </div>
              ))}
              {suggestions.stressRisk && (
                <div className="text-center">
                  <div className="text-red-400 text-lg">⚠️</div>
                  <div className="text-gray-500 text-xs">Stress</div>
                </div>
              )}
            </div>
            {suggestions.stressRisk && suggestions.stressNote && (
              <p className="text-red-400 text-xs mt-2">{suggestions.stressNote}</p>
            )}
          </div>
          {(suggestions.meals || []).map((meal, i) => <MealCard key={i} meal={meal} index={i} />)}
          <button onClick={onReset}
            className="w-full bg-gray-800 text-gray-400 font-semibold py-3 rounded-xl text-sm mt-1">
            Regenerate
          </button>
        </>
      )}
    </div>
  );
};

// ── LogView ───────────────────────────────────────────────────────────────────

const RatingRow = ({ value, onChange, activeColor }) => (
  <div className="flex gap-2">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} onClick={() => onChange(n)}
        className={`w-9 h-9 rounded-full border-2 text-sm font-bold transition-all ${
          value >= n ? `${activeColor} border-transparent text-black` : 'bg-gray-800 border-gray-700 text-gray-500'
        }`}>
        {n}
      </button>
    ))}
  </div>
);

const LogView = ({ ratings, onRate }) => {
  const dates = weekDates();
  const [sel, setSel] = useState(todayStr());
  const [form, setForm] = useState({ followed: null, energy: 0, hunger: 0 });

  useEffect(() => {
    setForm(ratings[sel] || { followed: null, energy: 0, hunger: 0 });
  }, [sel, ratings]);

  const canSave = form.followed !== null && form.energy > 0 && form.hunger > 0;

  return (
    <div className="px-4 py-6">
      <h1 className="text-white text-2xl font-bold mb-1">Daily Log</h1>
      <p className="text-gray-500 text-sm mb-5">Rate how each day went</p>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {dates.map(d => {
          const dt = new Date(d + 'T12:00:00');
          const hasRating = !!ratings[d];
          return (
            <button key={d} onClick={() => setSel(d)}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-all min-w-[48px] ${
                sel === d ? 'bg-green-500 text-black' : hasRating ? 'bg-gray-800 text-green-400' : 'bg-gray-900 text-gray-500'
              }`}>
              <span className="text-xs">{dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="font-bold text-sm">{dt.getDate()}</span>
              {hasRating && <span className="text-xs leading-none">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-gray-900 rounded-2xl p-4 space-y-5">
        <div>
          <p className="text-white font-semibold mb-3 text-sm">Did you follow the plan?</p>
          <div className="flex gap-2">
            {['Yes', 'Mostly', 'No'].map(v => (
              <button key={v} onClick={() => setForm(f => ({ ...f, followed: v }))}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  form.followed === v ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-white font-semibold mb-3 text-sm">Energy Level</p>
          <RatingRow value={form.energy} onChange={v => setForm(f => ({ ...f, energy: v }))} activeColor="bg-yellow-400" />
        </div>
        <div>
          <p className="text-white font-semibold mb-3 text-sm">Hunger Level</p>
          <RatingRow value={form.hunger} onChange={v => setForm(f => ({ ...f, hunger: v }))} activeColor="bg-orange-400" />
        </div>
        <button onClick={() => canSave && onRate(sel, form)} disabled={!canSave}
          className="w-full bg-green-500 text-black font-bold py-3 rounded-xl text-sm disabled:opacity-40">
          Save
        </button>
      </div>
    </div>
  );
};

// ── TrendsView ───────────────────────────────────────────────────────────────

const TrendsView = ({ healthHistory, ratings }) => {
  const dates = weekDates();
  const pick = (key, fallback = 0) => dates.map(d => Number(healthHistory[d]?.[key]) || fallback);

  const adherence = dates.map(d => {
    const r = ratings[d];
    if (!r) return 0;
    return r.followed === 'Yes' ? 3 : r.followed === 'Mostly' ? 2 : 1;
  });

  const cards = [
    { label: 'Weight (lbs)',    data: pick('weight', 185), color: '#22c55e', unit: 'lbs' },
    { label: 'HRV (ms)',        data: pick('hrv'),          color: '#60a5fa', unit: 'ms'  },
    { label: 'Active Cal',      data: pick('activeCalories'), color: '#f59e0b', unit: 'kcal'},
    { label: 'Sleep (hrs)',     data: pick('sleepHours'),   color: '#a78bfa', unit: 'h'   },
    { label: 'Steps',           data: pick('steps'),         color: '#34d399', unit: ''   },
    { label: 'Adherence',       data: adherence,             color: '#f472b6', unit: ''   },
  ];

  return (
    <div className="px-4 py-6">
      <h1 className="text-white text-2xl font-bold mb-1">7-Day Trends</h1>
      <p className="text-gray-500 text-sm mb-5">{dates[0]} → {dates[6]}</p>
      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ label, data, color, unit }) => {
          const last = data[data.length - 1];
          const first = data.find(v => v > 0) || 0;
          const delta = last - first;
          return (
            <div key={label} className="bg-gray-900 rounded-2xl p-3">
              <p className="text-gray-500 text-xs mb-1">{label}</p>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-white font-bold">{last > 0 ? `${last}${unit}` : '—'}</span>
                {last > 0 && delta !== 0 && (
                  <span className={`text-xs font-semibold ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                  </span>
                )}
              </div>
              <Sparkline data={data} color={color} width={110} height={34} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── SettingsView ─────────────────────────────────────────────────────────────

const SettingsView = ({ profile, onSave, apiKey, onApiKeySave }) => {
  const [form, setForm] = useState(profile);
  const [key, setKey]   = useState(apiKey || '');
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    onSave(form);
    onApiKeySave(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const FIELDS = [
    { k: 'weight',          label: 'Weight (lbs)',    type: 'number' },
    { k: 'bmr',             label: 'BMR (kcal)',       type: 'number' },
    { k: 'bodyFat',         label: 'Body Fat %',       type: 'number' },
    { k: 'muscleMass',      label: 'Muscle Mass (lbs)',type: 'number' },
    { k: 'foodPreferences', label: 'Food Preferences', type: 'text'   },
  ];

  return (
    <div className="px-4 py-6">
      <h1 className="text-white text-2xl font-bold mb-5">Settings</h1>

      <div className="bg-gray-900 rounded-2xl p-4 mb-4">
        <h3 className="text-white font-semibold mb-1 text-sm">Anthropic API Key</h3>
        <p className="text-gray-500 text-xs mb-3">Stored in localStorage only — never leaves your device except to Anthropic.</p>
        <input type="password" value={key} onChange={e => setKey(e.target.value)}
          placeholder="sk-ant-api03-…"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-green-500 outline-none font-mono" />
      </div>

      <div className="bg-gray-900 rounded-2xl p-4 mb-4">
        <h3 className="text-white font-semibold mb-3 text-sm">Profile</h3>
        <div className="mb-3">
          <label className="text-gray-500 text-xs mb-1 block">Goal</label>
          <div className="flex gap-2">
            {['Cut', 'Maintain', 'Bulk'].map(g => (
              <button key={g} onClick={() => set('goal', g)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold ${
                  form.goal === g ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {FIELDS.map(({ k, label, type }) => (
            <div key={k}>
              <label className="text-gray-500 text-xs mb-1 block">{label}</label>
              <input type={type} value={form[k]}
                onChange={e => set(k, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-green-500 outline-none" />
            </div>
          ))}
        </div>
      </div>

      <button onClick={save}
        className="w-full bg-green-500 text-black font-bold py-3 rounded-xl text-sm">
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  );
};

// ── WeeklySummaryCard ────────────────────────────────────────────────────────

const WeeklySummaryCard = ({ summary, onClose }) => {
  if (!summary) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-gray-900 rounded-t-3xl p-6 pb-10 max-w-md mx-auto"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />
        <h2 className="text-white text-xl font-bold mb-1">Week in Review</h2>
        <p className="text-gray-500 text-sm mb-5">Ending {todayStr()}</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Avg Deficit',   value: `${summary.avgDeficit} kcal`, color: 'text-green-400' },
            { label: 'Adherence',     value: `${summary.adherenceRate}%`,   color: 'text-blue-400'  },
            { label: 'HRV Trend',     value: summary.hrvTrend,              color: 'text-purple-400'},
            { label: 'Weight Delta',  value: `${summary.weightDelta > 0 ? '+' : ''}${summary.weightDelta} lbs`,
              color: summary.weightDelta <= 0 ? 'text-green-400' : 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-800 rounded-xl p-3 text-center">
              <div className={`font-bold text-lg ${color}`}>{value}</div>
              <div className="text-gray-500 text-xs">{label}</div>
            </div>
          ))}
        </div>
        {summary.insight && (
          <div className="bg-gray-800 rounded-xl p-4 mb-4">
            <p className="text-gray-300 text-sm leading-relaxed">💡 {summary.insight}</p>
          </div>
        )}
        <button onClick={onClose} className="w-full bg-green-500 text-black font-bold py-3 rounded-xl text-sm">
          Got it
        </button>
      </div>
    </div>
  );
};

// ── BottomNav ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'today',    label: 'Today',    icon: '🥗' },
  { id: 'log',      label: 'Log',      icon: '📋' },
  { id: 'trends',   label: 'Trends',   icon: '📈' },
  { id: 'settings', label: 'Settings', icon: '⚙️'  },
];

const BottomNav = ({ view, setView }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 flex safe-area-inset-bottom">
    {TABS.map(({ id, label, icon }) => (
      <button key={id} onClick={() => setView(id)}
        className={`flex-1 flex flex-col items-center py-3 transition-colors ${
          view === id ? 'text-green-400' : 'text-gray-600'}`}>
        <span className="text-xl">{icon}</span>
        <span className="text-xs mt-0.5 font-medium">{label}</span>
      </button>
    ))}
  </nav>
);

// ── Anthropic SSE streaming ───────────────────────────────────────────────────

const generateSuggestions = async (apiKey, healthData, profile, recentRatings, setStreamingText) => {
  const ratingsCtx = Object.entries(recentRatings).slice(-7)
    .map(([d, r]) => `${d}: followed=${r.followed}, energy=${r.energy}/5, hunger=${r.hunger}/5`)
    .join('\n') || 'No feedback yet';

  const system = `You are a precision nutrition coach. Reply with valid JSON only — no prose, no markdown fences.
Schema:
{
  "summary": string,
  "tdee": number,
  "targetCalories": number,
  "deficit": number,
  "stressRisk": boolean,
  "stressNote": string,
  "isRestDay": boolean,
  "meals": [
    {"name":string,"calories":number,"protein":number,"carbs":number,"fat":number,"rationale":string}
  ],
  "weeklyInsight": string
}
Rules:
1. TDEE = BMR + active calories burned
2. targetCalories = TDEE minus 400-500 kcal for Cut; no deficit for Maintain; +200 for Bulk
3. Rest day (workoutType=None): reduce target by 150 kcal more, increase fat ratio slightly
4. Protein always ~${Math.round(profile.muscleMass)}g (1g/lb lean mass=${profile.muscleMass}lbs)
5. Strength or Endurance day: add 50-75g net carbs vs rest day
6. stressRisk=true if HRV < 7-day average AND sleep < 7 hours
7. Exactly 3 meals: breakfast anchor, lunch target, dinner constraint
8. Food style: ${profile.foodPreferences}
9. weeklyInsight: include only on Sundays, otherwise omit or empty string`;

  const user = `PROFILE: goal=${profile.goal}, weight=${profile.weight}lbs, BMR=${profile.bmr}kcal, bodyFat=${profile.bodyFat}%, muscleMass=${profile.muscleMass}lbs
TODAY: activeCalories=${healthData.activeCalories||'?'}, hrv=${healthData.hrv||'?'}ms, 7dayAvgHRV=${healthData.avgHrv||'?'}ms, sleep=${healthData.sleepHours||'?'}h, restingHR=${healthData.restingHR||'?'}bpm, steps=${healthData.steps||'?'}, workout=${healthData.workoutType||'None'} ${healthData.workoutMinutes||0}min
RECENT FEEDBACK:\n${ratingsCtx}
Date: ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}${isSunday()?' (Sunday — include weeklyInsight)':''}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      stream: true,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const evt = JSON.parse(data);
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          accumulated += evt.delta.text;
          setStreamingText(accumulated);
        }
      } catch {}
    }
  }

  const match = accumulated.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response. Try again.');
  return JSON.parse(match[0]);
};

// ── App root ─────────────────────────────────────────────────────────────────

function App() {
  const [view, setView]               = useState('today');
  const [profile, setProfile]         = useState(() => ls.get('hd_profile', DEFAULT_PROFILE));
  const [apiKey, setApiKey]           = useState(() => localStorage.getItem('hd_apiKey') || '');
  const [ratings, setRatings]         = useState(() => ls.get('hd_ratings', {}));
  const [healthHistory, setHH]        = useState(() => ls.get('hd_healthHistory', {}));
  const [healthData, setHealthData]   = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [streamingText, setStreaming] = useState('');
  const [error, setError]             = useState(null);
  const [weeklySummary, setWeekly]    = useState(null);

  useEffect(() => { tryHealthKit().then(d => { if (d) setHealthData(d); }); }, []);

  const saveProfile = useCallback(p => { setProfile(p); ls.set('hd_profile', p); }, []);
  const saveApiKey  = useCallback(k => { setApiKey(k);  localStorage.setItem('hd_apiKey', k); }, []);
  const saveRating  = useCallback((date, r) => {
    const next = { ...ratings, [date]: r };
    setRatings(next); ls.set('hd_ratings', next);
  }, [ratings]);

  const handleGenerate = useCallback(async (manualData) => {
    if (!apiKey) { setError('Add your Anthropic API key in Settings first.'); return; }
    const data = manualData || healthData || {};
    const hrvs = Object.values(healthHistory).map(d => Number(d.hrv)).filter(v => v > 0);
    if (data.hrv) hrvs.push(Number(data.hrv));
    const avgHrv = hrvs.length ? Math.round(hrvs.reduce((a, b) => a + b, 0) / hrvs.length) : null;
    const enriched = { ...data, avgHrv, weight: profile.weight };

    setLoading(true); setError(null); setStreaming('');
    try {
      const result = await generateSuggestions(apiKey, enriched, profile, ratings, setStreaming);
      setSuggestions(result);
      const today = todayStr();
      const nextHH = { ...healthHistory, [today]: { ...enriched, tdee: result.tdee, targetCalories: result.targetCalories } };
      setHH(nextHH); ls.set('hd_healthHistory', nextHH);

      if (isSunday() && result.weeklyInsight) {
        const dates = weekDates();
        const weekR = dates.map(d => ratings[d]).filter(Boolean);
        const adherenceRate = weekR.length
          ? Math.round(weekR.filter(r => r.followed === 'Yes').length / weekR.length * 100) : 0;
        const weights = dates.map(d => Number(nextHH[d]?.weight)).filter(v => v > 0);
        const weightDelta = weights.length >= 2
          ? parseFloat((weights[weights.length - 1] - weights[0]).toFixed(1)) : 0;
        const hrvVals = dates.map(d => Number(nextHH[d]?.hrv)).filter(v => v > 0);
        const hrvTrend = hrvVals.length >= 2
          ? (hrvVals[hrvVals.length - 1] > hrvVals[0] ? '↑ Improving' : '↓ Declining') : 'N/A';
        const deficits = dates.map(d => {
          const h = nextHH[d]; return h?.tdee && h?.targetCalories ? h.tdee - h.targetCalories : null;
        }).filter(v => v !== null);
        const avgDeficit = deficits.length
          ? Math.round(deficits.reduce((a, b) => a + b, 0) / deficits.length) : result.deficit;
        setWeekly({ avgDeficit, adherenceRate, hrvTrend, weightDelta, insight: result.weeklyInsight });
      }
    } catch (e) {
      setError(e.message || 'Generation failed. Check your API key and connection.');
    } finally {
      setLoading(false);
    }
  }, [apiKey, healthData, healthHistory, profile, ratings]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-md mx-auto pb-20">
        {view === 'today' && (
          <TodayView suggestions={suggestions} loading={loading} streamingText={streamingText}
            error={error} healthData={healthData} onGenerate={handleGenerate}
            onReset={() => { setSuggestions(null); setError(null); }} />
        )}
        {view === 'log'      && <LogView ratings={ratings} onRate={saveRating} />}
        {view === 'trends'   && <TrendsView healthHistory={healthHistory} ratings={ratings} />}
        {view === 'settings' && (
          <SettingsView profile={profile} onSave={saveProfile} apiKey={apiKey} onApiKeySave={saveApiKey} />
        )}
      </div>
      <BottomNav view={view} setView={setView} />
      <WeeklySummaryCard summary={weeklySummary} onClose={() => setWeekly(null)} />
    </div>
  );
}
