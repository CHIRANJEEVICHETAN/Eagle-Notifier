# 📦 `jk2` Table (Schema: `public`)

## 🧩 Columns

| Column Name         | Data Type                     | Nullable | Default                           |
| ------------------- | ----------------------------- | -------- | --------------------------------- |
| `hz1sv`             | `double precision`            | ✅        |                                   |
| `hz1pv`             | `double precision`            | ✅        |                                   |
| `hz2sv`             | `double precision`            | ✅        |                                   |
| `hz2pv`             | `double precision`            | ✅        |                                   |
| `cpsv`              | `double precision`            | ✅        |                                   |
| `cppv`              | `double precision`            | ✅        |                                   |
| `tz1sv`             | `double precision`            | ✅        |                                   |
| `tz1pv`             | `double precision`            | ✅        |                                   |
| `tz2sv`             | `double precision`            | ✅        |                                   |
| `tz2pv`             | `double precision`            | ✅        |                                   |
| `deppv`             | `double precision`            | ✅        |                                   |
| `oilpv`             | `double precision`            | ✅        |                                   |
| `postpv`            | `double precision`            | ✅        |                                   |
| `dephz`             | `double precision`            | ✅        |                                   |
| `hardhz`            | `double precision`            | ✅        |                                   |
| `oilhz`             | `double precision`            | ✅        |                                   |
| `posthz`            | `double precision`            | ✅        |                                   |
| `temphz`            | `double precision`            | ✅        |                                   |
| `hz1ht`             | `double precision`            | ✅        |                                   |
| `hz1lt`             | `double precision`            | ✅        |                                   |
| `hz2ht`             | `double precision`            | ✅        |                                   |
| `hz2lt`             | `double precision`            | ✅        |                                   |
| `cph`               | `double precision`            | ✅        |                                   |
| `cpl`               | `double precision`            | ✅        |                                   |
| `oiltemphigh`       | `boolean`                     | ✅        |                                   |
| `oillevelhigh`      | `boolean`                     | ✅        |                                   |
| `oillevellow`       | `boolean`                     | ✅        |                                   |
| `hz1hfail`          | `boolean`                     | ✅        |                                   |
| `hz2hfail`          | `boolean`                     | ✅        |                                   |
| `hardconfail`       | `boolean`                     | ✅        |                                   |
| `hardcontraip`      | `boolean`                     | ✅        |                                   |
| `oilconfail`        | `boolean`                     | ✅        |                                   |
| `oilcontraip`       | `boolean`                     | ✅        |                                   |
| `hz1fanfail`        | `boolean`                     | ✅        |                                   |
| `hz2fanfail`        | `boolean`                     | ✅        |                                   |
| `hz1fantrip`        | `boolean`                     | ✅        |                                   |
| `hz2fantrip`        | `boolean`                     | ✅        |                                   |
| `tz1ht`             | `double precision`            | ✅        |                                   |
| `tz1lt`             | `double precision`            | ✅        |                                   |
| `tz2ht`             | `double precision`            | ✅        |                                   |
| `tz2lt`             | `double precision`            | ✅        |                                   |
| `tempconfail`       | `boolean`                     | ✅        |                                   |
| `tempcontraip`      | `boolean`                     | ✅        |                                   |
| `tz1fanfail`        | `boolean`                     | ✅        |                                   |
| `tz2fanfail`        | `boolean`                     | ✅        |                                   |
| `tz1fantrip`        | `boolean`                     | ✅        |                                   |
| `tz2fantrip`        | `boolean`                     | ✅        |                                   |
| `sp1`               | `double precision`            | ✅        |                                   |
| `sp2`               | `double precision`            | ✅        |                                   |
| `sp3`               | `double precision`            | ✅        |                                   |
| `sp4`               | `double precision`            | ✅        |                                   |
| `sp5`               | `double precision`            | ✅        |                                   |
| `sp6`               | `double precision`            | ✅        |                                   |
| `sp7`               | `double precision`            | ✅        |                                   |
| `sp8`               | `double precision`            | ✅        |                                   |
| `sp9`               | `double precision`            | ✅        |                                   |
| `sp10`              | `double precision`            | ✅        |                                   |
| `sp11`              | `double precision`            | ✅        |                                   |
| `sp12`              | `double precision`            | ✅        |                                   |
| `sp15`              | `double precision`            | ✅        |                                   |
| `sp16`              | `double precision`            | ✅        |                                   |
| `sp17`              | `double precision`            | ✅        |                                   |
| `sp18`              | `double precision`            | ✅        |                                   |
| `sp19`              | `double precision`            | ✅        |                                   |
| `sp20`              | `double precision`            | ✅        |                                   |
| `id`                | `integer`                     | ❌        | `nextval('jk2_id_seq'::regclass)` |
| `created_timestamp` | `timestamp without time zone` | ❌        |                                   |

---

## 🔑 Indexes

* `jk2_pkey` – **Primary Key**, btree(`id`)