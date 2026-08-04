-- Cloudflare migration helpers.
-- Run this file once in Supabase SQL Editor before testing the Cloudflare site.

create or replace function public.submit_idiom_attempt(
  p_student_id uuid,
  p_idiom_num integer,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key jsonb;
  v_explanations jsonb;
  v_total integer;
  v_score integer;
  v_all_correct boolean;
  v_existing public.attempts%rowtype;
  v_first_attempt boolean := false;
  v_awarded boolean := false;
  v_first_attempt_correct boolean;
  v_practice_completed boolean;
  v_attempt_count integer;
begin
  if not exists (
    select 1 from public.students
    where id = p_student_id and active = true
  ) then
    return jsonb_build_object('ok', false, 'code', 'STUDENT_INACTIVE');
  end if;

  select answer_key, explanations
  into v_key, v_explanations
  from public.idiom_answers
  where idiom_num = p_idiom_num;

  if v_key is null then
    return jsonb_build_object('ok', false, 'code', 'IDIOM_NOT_OPEN');
  end if;

  if jsonb_typeof(p_answers) <> 'array'
    or jsonb_array_length(p_answers) <> jsonb_array_length(v_key) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_ANSWERS');
  end if;

  v_total := jsonb_array_length(v_key);
  select count(*) filter (where submitted.value = expected.value)::integer
  into v_score
  from jsonb_array_elements(p_answers) with ordinality as submitted(value, position)
  join jsonb_array_elements(v_key) with ordinality as expected(value, position)
    using (position);
  v_all_correct := v_score = v_total;

  -- Serialize two near-simultaneous submissions from the same student and idiom.
  perform pg_advisory_xact_lock(
    hashtextextended(p_student_id::text || ':' || p_idiom_num::text, 0)
  );

  select *
  into v_existing
  from public.attempts
  where student_id = p_student_id and idiom_num = p_idiom_num
  for update;

  if not found then
    v_first_attempt := true;
    insert into public.attempts (
      student_id,
      idiom_num,
      first_attempt_correct,
      first_attempt_answers,
      practice_completed,
      attempt_count,
      last_score
    ) values (
      p_student_id,
      p_idiom_num,
      v_all_correct,
      p_answers,
      v_all_correct,
      1,
      v_score
    )
    returning first_attempt_correct, practice_completed, attempt_count
    into v_first_attempt_correct, v_practice_completed, v_attempt_count;

    if v_all_correct then
      insert into public.gold_cards (student_id, idiom_num)
      values (p_student_id, p_idiom_num)
      on conflict (student_id, idiom_num) do nothing
      returning true into v_awarded;
      v_awarded := coalesce(v_awarded, false);
    end if;
  else
    update public.attempts
    set practice_completed = practice_completed or v_all_correct,
        attempt_count = attempt_count + 1,
        last_score = v_score,
        updated_at = now()
    where id = v_existing.id
    returning first_attempt_correct, practice_completed, attempt_count
    into v_first_attempt_correct, v_practice_completed, v_attempt_count;
  end if;

  return jsonb_build_object(
    'ok', true,
    'score', v_score,
    'total', v_total,
    'all_correct', v_all_correct,
    'first_attempt', v_first_attempt,
    'awarded', v_awarded,
    'correct_answers', v_key,
    'explanations', v_explanations,
    'attempt', jsonb_build_object(
      'idiom_num', p_idiom_num,
      'first_attempt_correct', v_first_attempt_correct,
      'practice_completed', v_practice_completed,
      'attempt_count', v_attempt_count,
      'last_score', v_score
    )
  );
end;
$$;

revoke all on function public.submit_idiom_attempt(uuid, integer, jsonb)
from public, anon, authenticated;
grant execute on function public.submit_idiom_attempt(uuid, integer, jsonb)
to service_role;

create or replace function public.get_teacher_results()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with open_count as (
    select count(*)::integer as value
    from public.idiom_answers
  ),
  attempt_stats as (
    select
      a.student_id,
      count(*) as attempted_count,
      count(*) filter (where a.practice_completed) as completed_count,
      count(*) filter (where a.first_attempt_correct) as first_correct_count,
      sum(a.attempt_count) as attempt_count,
      max(a.updated_at) as last_activity_at,
      jsonb_agg(
        jsonb_build_object(
          'idiom_num', a.idiom_num,
          'idiom_name', coalesce(i.idiom_name, '成语 ' || a.idiom_num::text),
          'first_attempt_correct', a.first_attempt_correct,
          'practice_completed', a.practice_completed,
          'attempt_count', a.attempt_count,
          'last_score', a.last_score,
          'updated_at', a.updated_at
        ) order by a.idiom_num
      ) as idioms
    from public.attempts a
    left join public.idiom_answers i on i.idiom_num = a.idiom_num
    group by a.student_id
  ),
  card_stats as (
    select student_id, count(*) as gold_card_count
    from public.gold_cards
    group by student_id
  ),
  student_rows as (
    select
      s.id,
      s.admin_class,
      s.student_number,
      s.course_type,
      s.teaching_class,
      coalesce(a.attempted_count, 0) as attempted_count,
      coalesce(a.completed_count, 0) as completed_count,
      case when o.value > 0
        then round(coalesce(a.completed_count, 0)::numeric / o.value * 100)::integer
        else null
      end as completion_rate,
      coalesce(a.first_correct_count, 0) as first_correct_count,
      case when coalesce(a.attempted_count, 0) > 0
        then round(coalesce(a.first_correct_count, 0)::numeric / a.attempted_count * 100)::integer
        else null
      end as first_correct_rate,
      coalesce(c.gold_card_count, 0) as gold_card_count,
      coalesce(a.attempt_count, 0) as attempt_count,
      a.last_activity_at,
      coalesce(a.idioms, '[]'::jsonb) as idioms
    from public.students s
    cross join open_count o
    left join attempt_stats a on a.student_id = s.id
    left join card_stats c on c.student_id = s.id
    where s.active = true
  )
  select jsonb_build_object(
    'open_idiom_count', (select value from open_count),
    'summary', jsonb_build_object(
      'student_count', (select count(*) from student_rows),
      'participating_count', (
        select count(*) from student_rows where attempted_count > 0
      ),
      'average_completed', coalesce((
        select round(avg(completed_count), 1) from student_rows
      ), 0),
      'first_correct_rate', (
        select case when sum(attempted_count) > 0
          then round(sum(first_correct_count)::numeric / sum(attempted_count) * 100)::integer
          else null
        end
        from student_rows
      ),
      'gold_card_count', coalesce((
        select sum(gold_card_count) from student_rows
      ), 0)
    ),
    'students', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'admin_class', admin_class,
          'student_number', student_number,
          'course_type', course_type,
          'teaching_class', teaching_class,
          'attempted_count', attempted_count,
          'completed_count', completed_count,
          'completion_rate', completion_rate,
          'first_correct_count', first_correct_count,
          'first_correct_rate', first_correct_rate,
          'gold_card_count', gold_card_count,
          'attempt_count', attempt_count,
          'last_activity_at', last_activity_at,
          'idioms', idioms
        ) order by admin_class, student_number
      )
      from student_rows
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_teacher_results()
from public, anon, authenticated;
grant execute on function public.get_teacher_results()
to service_role;

notify pgrst, 'reload schema';
