(ns metabase-enterprise.caching.strategies
  (:require
   [java-time.api :as t]
   [malli.core :as mc]
   [metabase.public-settings :as public-settings]
   [metabase.public-settings.premium-features :refer [defenterprise defenterprise-schema]]
   [metabase.query-processor.middleware.cache-backend.db :as backend.db]
   [metabase.util.cron :as u.cron]
   [metabase.util.log :as log]
   [metabase.util.malli.schema :as ms]
   [toucan2.core :as t2]))

(set! *warn-on-reflection* true)

(def CacheStrategy ;; not used in API since there are some additional fields
  "Schema for a caching strategy"
  (mc/schema
   [:and
    [:map
     [:type [:enum :nocache :ttl :duration :schedule :query]]]
    [:multi {:dispatch :type}
     [:nocache  [:map
                 [:type keyword?]]]
     [:ttl      [:map
                 [:type keyword?]
                 [:multiplier ms/PositiveInt]
                 [:min_duration ms/PositiveInt]]]
     [:duration [:map
                 [:type keyword?]
                 [:duration ms/PositiveInt]
                 [:unit [:enum "hours" "minutes" "seconds" "days"]]]]
     [:schedule [:map
                 [:type keyword?]
                 [:updated_at some?]
                 [:schedule u.cron/CronScheduleString]]]
     [:query    [:map
                 [:type keyword?]
                 [:updated_at some?]
                 [:payload [:maybe any?]]
                 [:field_id int?]
                 [:aggregation [:enum "max" "count"]]
                 [:schedule string?]]]]]))

(defn granular-ttl
  "Returns the granular cache ttl (in hours) for a card. On EE, this first checking whether there is a stored value
   for the card, dashboard, or database (in that order of decreasing preference). Returns nil on OSS."
  [card dashboard-id]
  ; stored TTLs are in hours; convert to seconds
  (or (:cache_ttl card)
      (:cache_ttl (t2/select-one [:model/Dashboard :cache_ttl] :id dashboard-id))
      (:cache_ttl (t2/select-one [:model/Database :cache_ttl] :id (:database_id card)))))

(defenterprise-schema granular-cache-strategy :- [:maybe CacheStrategy]
  "Returns the granular cache strategy for a card."
  :feature :cache-granular-controls
  [card dashboard-id]
  (when (public-settings/enable-query-caching)
    (let [qs     [{:from   [:cache_config]
                   :select [:id
                            [[:inline 1] :ordering]]
                   :where  [:and [:= :model "question"]   [:= :model_id (:id card)]]}
                  {:from   [:cache_config]
                   :select [:id
                            [[:inline 1] :ordering]]
                   :where  [:and [:= :model "dashboard"]  [:= :model_id dashboard-id]]}
                  {:from   [:cache_config]
                   :select [:id
                            [[:inline 1] :ordering]]
                   :where  [:and [:= :model "collection"] [:= :model_id (:collection_id card)]]}
                  {:from   [:cache_config]
                   :select [:id
                            [[:inline 1] :ordering]]
                   :where  [:and [:= :model "database"]   [:= :model_id (:database_id card)]]}
                  {:from   [:cache_config]
                   :select [:id
                            [[:inline 1] :ordering]]
                   :where  [:= :model "root"]}]
          q      {:select   [:id]
                  :limit    1
                  :from     [[{:union-all qs} :unused_alias]]
                  :order-by :ordering}
          config (t2/select-one :model/CacheConfig :id q)]
      (if config
        (merge {:type       (:strategy config)
                :updated_at (:updated_at config)
                :payload    (:payload config)}
               (:config config))
        (when-let [ttl (granular-ttl card dashboard-id)]
          {:type     :duration
           :duration ttl
           :unit     "hours"})))))

;;; Strategy execution

(defmulti fetch-cache-stmt-ee*
  "Generate prepared statement for a db cache backend for a given strategy"
  (fn [strategy _hash _conn] (:type strategy)))

(defmethod fetch-cache-stmt-ee* :ttl [strategy query-hash conn]
  (backend.db/fetch-cache-stmt-ttl strategy query-hash conn))

(defmethod fetch-cache-stmt-ee* :duration [strategy query-hash conn]
  (assert (:duration strategy))
  (assert (:unit strategy))
  (let [duration  (t/duration (:duration strategy) (keyword (:unit strategy)))
        timestamp (t/minus (t/offset-date-time) duration)]
    (backend.db/prepare-statement conn query-hash timestamp)))

;; NOTE: something changes `:updated_at` to `:updated-at`
(defmethod fetch-cache-stmt-ee* :schedule [{:keys [updated-at] :as strategy} query-hash conn]
  (if-not updated-at
    (log/debugf "Caching strategy %s was never run yet" (pr-str strategy))
    (backend.db/prepare-statement conn query-hash updated-at)))

(defmethod fetch-cache-stmt-ee* :query [{:keys [updated-at] :as strategy} query-hash conn]
  (if-not updated-at
    (log/debugf "Caching strategy %s was never run yet" (pr-str strategy))
    (backend.db/prepare-statement conn query-hash updated-at)))

(defmethod fetch-cache-stmt-ee* :nocache [_ _ _]
  nil)

(defenterprise fetch-cache-stmt
  "Returns prepared statement to query for db cache backend."
  :feature :cache-granular-controls
  [strategy query-hash conn]
  (fetch-cache-stmt-ee* strategy query-hash conn))
