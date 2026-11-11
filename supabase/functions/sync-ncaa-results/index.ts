import { withSupabase } from 'npm:@supabase/server@1';
import {
  NCAA_BRACKET_URL, NCAA_CHAMPIONSHIP_ID, buildNcaaUrl, extractOfficialResults,
  assertResultsDoNotRegress
} from '../_shared/ncaa-results.js';

const TOURNAMENT_KEY = '2026-d3-men';

export default {
  fetch: withSupabase({auth: 'secret'}, async (_request, ctx) => {
    const admin = ctx.supabaseAdmin;
    const attempt = new Date().toISOString();

    try {
      const response = await fetch(buildNcaaUrl(), {
        headers: {'accept': 'application/json', 'user-agent': 'D3-Soccer-Bracket/1.0'}
      });
      if (!response.ok) throw new Error(`NCAA returned HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.errors?.length) throw new Error(`NCAA query failed: ${payload.errors[0]?.message || 'unknown error'}`);
      const championship = payload?.data?.championships?.find(
        item => Number(item?.championshipId) === NCAA_CHAMPIONSHIP_ID
      );
      if (!Array.isArray(championship?.games)) throw new Error('NCAA response has no championship games array');
      const contests = championship.games.map(game => ({...game, championshipId: NCAA_CHAMPIONSHIP_ID}));
      const results = extractOfficialResults(contests);
      const {data: current, error: readError} = await admin.from('official_results')
        .select('results').eq('tournament_key', TOURNAMENT_KEY).single();
      if (readError) throw readError;
      assertResultsDoNotRegress(current?.results || {}, results);

      const {error: writeError} = await admin.from('official_results').update({
        results,
        synced_at: attempt,
        last_attempt_at: attempt,
        last_error: null,
        source_url: NCAA_BRACKET_URL
      }).eq('tournament_key', TOURNAMENT_KEY);
      if (writeError) throw writeError;

      return Response.json({ok: true, games: Object.keys(results).length});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin.from('official_results').update({last_attempt_at: attempt, last_error: message})
        .eq('tournament_key', TOURNAMENT_KEY);
      return Response.json({ok: false, error: message}, {status: 502});
    }
  })
};
