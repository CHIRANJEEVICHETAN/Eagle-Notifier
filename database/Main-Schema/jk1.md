# 📦 `jk1` Table (Schema: `public`)

## 🧩 Columns

| Column Name         | Data Type                     | Nullable | Default                           |
| ------------------- | ----------------------------- | -------- | --------------------------------- |
| `date_time`         | `text`                        | ✅        |                                   |
| `batch_no`          | `text`                        | ✅        |                                   |
| `hz1sv`             | `character varying(50)`       | ✅        |                                   |
| `hz1pv`             | `character varying(50)`       | ✅        |                                   |
| `hz2sv`             | `character varying(50)`       | ✅        |                                   |
| `hz2pv`             | `character varying(50)`       | ✅        |                                   |
| `cpsv`              | `character varying(50)`       | ✅        |                                   |
| `cppv`              | `character varying(50)`       | ✅        |                                   |
| `tz1sv`             | `character varying(50)`       | ✅        |                                   |
| `tz1pv`             | `character varying(50)`       | ✅        |                                   |
| `tz2sv`             | `character varying(50)`       | ✅        |                                   |
| `tz2pv`             | `character varying(50)`       | ✅        |                                   |
| `deppv`             | `character varying(50)`       | ✅        |                                   |
| `oilpv`             | `character varying(50)`       | ✅        |                                   |
| `postpv`            | `character varying(50)`       | ✅        |                                   |
| `dephz`             | `character varying(50)`       | ✅        |                                   |
| `hardhz`            | `character varying(50)`       | ✅        |                                   |
| `oilhz`             | `character varying(50)`       | ✅        |                                   |
| `posthz`            | `character varying(50)`       | ✅        |                                   |
| `temphz`            | `character varying(50)`       | ✅        |                                   |
| `custname`          | `text`                        | ✅        |                                   |
| `description`       | `text`                        | ✅        |                                   |
| `grade`             | `text`                        | ✅        |                                   |
| `partname`          | `text`                        | ✅        |                                   |
| `partnumber`        | `text`                        | ✅        |                                   |
| `sp1`               | `text`                        | ✅        |                                   |
| `sp2`               | `text`                        | ✅        |                                   |
| `sp3`               | `text`                        | ✅        |                                   |
| `sp4`               | `text`                        | ✅        |                                   |
| `sp5`               | `text`                        | ✅        |                                   |
| `sp6`               | `text`                        | ✅        |                                   |
| `sp7`               | `text`                        | ✅        |                                   |
| `sp8`               | `text`                        | ✅        |                                   |
| `sp9`               | `text`                        | ✅        |                                   |
| `sp10`              | `text`                        | ✅        |                                   |
| `id`                | `integer`                     | ❌        | `nextval('jk1_id_seq'::regclass)` |
| `created_timestamp` | `timestamp without time zone` | ✅        | `CURRENT_TIMESTAMP`               |

---

## 🔑 Indexes

* `jk1_pkey` – **Primary Key**, btree(`id`)
