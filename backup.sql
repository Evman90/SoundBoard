--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    default_response_enabled boolean DEFAULT false,
    default_response_sound_clip_ids integer[] DEFAULT '{}'::integer[],
    default_response_delay integer DEFAULT 2000,
    default_response_index integer DEFAULT 0
);


ALTER TABLE public.settings OWNER TO neondb_owner;

--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.settings_id_seq OWNER TO neondb_owner;

--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: sound_clips; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sound_clips (
    id integer NOT NULL,
    name text NOT NULL,
    filename text NOT NULL,
    format text NOT NULL,
    duration real NOT NULL,
    size integer NOT NULL,
    url text NOT NULL
);


ALTER TABLE public.sound_clips OWNER TO neondb_owner;

--
-- Name: sound_clips_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sound_clips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sound_clips_id_seq OWNER TO neondb_owner;

--
-- Name: sound_clips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sound_clips_id_seq OWNED BY public.sound_clips.id;


--
-- Name: trigger_words; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.trigger_words (
    id integer NOT NULL,
    phrase text NOT NULL,
    sound_clip_id integer NOT NULL,
    case_sensitive boolean DEFAULT false,
    enabled boolean DEFAULT true
);


ALTER TABLE public.trigger_words OWNER TO neondb_owner;

--
-- Name: trigger_words_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.trigger_words_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trigger_words_id_seq OWNER TO neondb_owner;

--
-- Name: trigger_words_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.trigger_words_id_seq OWNED BY public.trigger_words.id;


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: sound_clips id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sound_clips ALTER COLUMN id SET DEFAULT nextval('public.sound_clips_id_seq'::regclass);


--
-- Name: trigger_words id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.trigger_words ALTER COLUMN id SET DEFAULT nextval('public.trigger_words_id_seq'::regclass);


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.settings (id, default_response_enabled, default_response_sound_clip_ids, default_response_delay, default_response_index) FROM stdin;
1	t	{2}	2000	0
\.


--
-- Data for Name: sound_clips; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sound_clips (id, name, filename, format, duration, size, url) FROM stdin;
2	Ding-dong-sound-effect	1753552027140_6b835f45b20eb36fd55e0b978ba30cde	mp3	4.9142	196568	/uploads/1753552027140_6b835f45b20eb36fd55e0b978ba30cde
\.


--
-- Data for Name: trigger_words; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.trigger_words (id, phrase, sound_clip_id, case_sensitive, enabled) FROM stdin;
2	Hi	2	f	t
\.


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.settings_id_seq', 1, true);


--
-- Name: sound_clips_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.sound_clips_id_seq', 2, true);


--
-- Name: trigger_words_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.trigger_words_id_seq', 2, true);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: sound_clips sound_clips_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sound_clips
    ADD CONSTRAINT sound_clips_pkey PRIMARY KEY (id);


--
-- Name: trigger_words trigger_words_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.trigger_words
    ADD CONSTRAINT trigger_words_pkey PRIMARY KEY (id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

