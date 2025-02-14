(ns metabase-enterprise.caching.api-test
  (:require
   [clojure.test :refer :all]
   [metabase-enterprise.caching.api :as caching.api]
   [metabase.public-settings :as public-settings]
   [metabase.query-processor.card :as qp.card]
   [metabase.test :as mt]
   [metabase.util :as u]
   [toucan2.core :as t2]))

(comment
  caching.api/keep-me)

(defn last-audit-event []
  (t2/select-one [:model/AuditLog :topic :user_id :model :model_id :details]
                 :topic :caching-update
                 {:order-by [[:id :desc]]}))

(deftest cache-config-test
  (mt/discard-setting-changes [enable-query-caching]
    (public-settings/enable-query-caching! true)
    (mt/with-model-cleanup [:model/CacheConfig]
      (testing "Caching requires premium token with `:caching`"
        (mt/with-premium-features #{}
          (is (= "Caching is a paid feature not currently available to your instance. Please upgrade to use it. Learn more at metabase.com/upgrade/"
                 (mt/user-http-request :crowberto :get 402 "ee/caching/")))))
      (testing "Caching API"
        (mt/with-premium-features #{:cache-granular-controls :audit-app}
          (mt/with-temp [:model/Database      db     {}
                         :model/Collection    col1   {:name "col1"}
                         :model/Dashboard     dash1  {:name          "dash1"
                                                      :collection_id (:id col1)}
                         :model/Card          card1  {:name          "card1"
                                                      :database_id   (:id db)
                                                      :collection_id (:id col1)}
                         :model/Card          card2  {:name          "card2"
                                                      :database_id   (:id db)
                                                      :collection_id (:id col1)}
                         :model/Card          card3  {:name "card3"}]

            (testing "No access from regular users"
              (is (= "You don't have permissions to do that."
                     (mt/user-http-request :rasta :get 403 "ee/caching/"))))

            (testing "Can configure root"
              (is (mt/user-http-request :crowberto :put 200 "ee/caching/"
                                        {:model    "root"
                                         :model_id 0
                                         :strategy {:type "nocache" :name "root"}}))
              (is (=? {:data [{:model "root" :model_id 0}]}
                      (mt/user-http-request :crowberto :get 200 "ee/caching/"
                                            :model "root")))
              (testing "Is audited"
                (is (=? {:topic    :caching-update
                         :user_id  (:id (mt/fetch-user :crowberto))
                         :model    "CacheConfig"
                         :model_id int?
                         :details  {:model     "root"
                                    :model-id  0
                                    :old-value nil
                                    :new-value {:strategy "nocache" :config {:name "root"}}}}
                        (last-audit-event)))))

            (testing "Can configure others"
              (is (mt/user-http-request :crowberto :put 200 "ee/caching/"
                                        {:model    "database"
                                         :model_id (:id db)
                                         :strategy {:type "nocache" :name "db"}}))
              (is (mt/user-http-request :crowberto :put 200 "ee/caching/"
                                        {:model    "dashboard"
                                         :model_id (:id dash1)
                                         :strategy {:type "nocache" :name "dash"}}))
              (is (mt/user-http-request :crowberto :put 200 "ee/caching/"
                                        {:model    "question"
                                         :model_id (:id card1)
                                         :strategy {:type "nocache" :name "card1"}})))

            (testing "HTTP responds with correct listings"
              (is (=? {:data [{:model "root" :model_id 0}]}
                      (mt/user-http-request :crowberto :get 200 "ee/caching/")))
              (is (=? {:data [{:model "database" :model_id (:id db)}]}
                      (mt/user-http-request :crowberto :get 200 "ee/caching/" {}
                                            :model :database)))
              (is (=? {:data [{:model "dashboard" :model_id (:id dash1)}
                               {:model "question" :model_id (:id card1)}]}
                      (mt/user-http-request :crowberto :get 200 "ee/caching/" {}
                                            :collection (:id col1) :model :dashboard :model :question))))

            (testing "We select correct config for something from a db"
              (testing "First card has own config"
                (is (=? {:type :nocache :name "card1"}
                        (:cache-strategy (#'qp.card/query-for-card card1 {} {} {} {}))))
                (is (=? {:type :nocache :name "card1"}
                        (:cache-strategy (#'qp.card/query-for-card card1 {} {} {} {:dashboard-id (u/the-id dash1)})))))
              (testing "Second card should hit database or dashboard cache"
                (is (=? {:type :nocache :name "db"}
                        (:cache-strategy (#'qp.card/query-for-card card2 {} {} {} {}))))
                (is (=? {:type :nocache :name "dash"}
                        (:cache-strategy (#'qp.card/query-for-card card2 {} {} {} {:dashboard-id (u/the-id dash1)})))))
              (testing "Third card targets other db and gets root config"
                (is (=? {:type :nocache :name "root"}
                        (:cache-strategy (#'qp.card/query-for-card card3 {} {} {} {}))))))

            (testing "It's possible to delete a configuration"
              (is (nil? (mt/user-http-request :crowberto :delete 204 "ee/caching"
                                              {:model    "database"
                                               :model_id (:id db)})))
              (testing "Listing for databases becomes empty"
                (is (=? {:data []}
                        (mt/user-http-request :crowberto :get 200 "ee/caching/" {}
                                              :model :database))))
              (testing "And card2 gets root config"
                (is (=? {:type :nocache :name "root"}
                        (:cache-strategy (#'qp.card/query-for-card card2 {} {} {} {}))))))))))))
