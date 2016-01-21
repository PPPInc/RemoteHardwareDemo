﻿/*
 *
 * Charge It Pro Cloud Hardware Library v1.0.0
 * https://www.chargeitpro.com/
 *
 * Copyright (C) Charge It Pro, Corporation. All rights reserved.
 *
 */

var CIP = new (function () {

    var self = this;

    self.version = '1.0.0';

    /*
     * These functions are to be implemented by consuming Developers.
     */
    self.OnResultFunction; //Function to be called when transaction results are returned from remote hardware.
    self.OnEchoFunction; //Function to be called when an echo response is returned from remote hardware.
    self.OnQuestionFunction; //Function to be called when remote hardware requires input from the POS to finish a transaction.
    self.OnConfigurationDownloadedFunction; //Function to be called when the configuration has been downloaded.
    self.OnErrorFunction; //Function to be called when the Hub reports an error.
    self.OnConnectedFunction; //Function to be called when Client connects to Hub.

    /*
     * These properties are to be set by consuming developers.
     */
    self.isTestMode = false; //Bool value indicating whether test mode is on or off.
    self.userName; //Unique name for this connection.
    self.controllerName; //Name of the remote hardware controller to send transactions.
    self.locationId; //LocationId for this connection.
    self.devices; //Array of remote hardware devices that transactions can be processed on.

    /*
     * These are functions that can be consumed by Developers and should not be assigned to or overwritten.
     */
    self.downloadConfiguration; //Call this function to download the configuration settings for your location.
    self.answerYesFunction; //Call this function to respond with "YES" to a question request from remote hardware.
    self.answerNoFunction; //Call this function to respond with "NO" to a question request from rmote hardware.
    self.echoFunction; //Call this function to test connectivity between your web-based POS and the remote hardware controller.
    self.debitSaleFunction; //Call this function to process a debit sale.
    self.creditSaleFunction; //Call this function to process a credit sale.
    self.creditReturnFunction; //Call this function to process a credit return.
    self.creditAuthFunction; //Call this function to authorize a transaction.
    self.creditForceFunction; //Call this function to force a credit sale.
    self.creditAddTipFunction; //Call this function to add a tip to a previous transaction.
    self.voidFunction; //Call this function to void a transaction.
    self.requestSignatureFunction; //Call this function to request a signature.
    self.saveCreditCardFunction; //Call this function to tokenize a credit card.
    self.displayTextFunction; //Call this function to display a message on the device screen.
    self.cancelFunction; //Call this function to cancel a transaction.

    /*
     * private variables
     */
    self._remoteHub;
    self._connected;

    /*
     * private functions
     */
    self._connect = function (done, fail) {

        if (self.controllerName === "") {
            if (self.OnErrorFunction) self.OnErrorFunction("ControllerName not set.");
            return;
        }

        var url;
        if (self.isTestMode) {
            //url = 'http://localhost:57192';
            url = "https://psl-staging.chargeitpro.com";
        } else {
            url = "https://psl.chargeitpro.com";
        }

        var connection = $.hubConnection(url);

        connection.qs = { "userName": self.userName };

        self._remoteHub = connection.createHubProxy("DeviceHub");

        self._remoteHub.on("send", function (from, message) {
            var result = JSON.parse(message);
            if (result.Action === "Echo") {
                if (self.OnEchoFunction)
                    self.OnEchoFunction(result.Data);
                return;
            } else if (result.Action === "Question") {
                if (self.OnQuestionFunction)
                    self.OnQuestionFunction(result.Data);
                return;
            } else if (result.Action === "Result") {
                if (result.ResultFields) {
                    if (self.OnResultFunction)
                        self.OnResultFunction(result);
                } else {
                    if (self.OnErrorFunction) self.OnErrorFunction("No Result returned from remote hardware.");
                }
                return;
            }
        })

        self._remoteHub.on("error", function (error) {
            if (self.OnErrorFunction) self.OnErrorFunction(error);
        })

        connection.start().done(function () {
            self._connected = true;
            console.log("Connected as: " + connection.id);
            if (self.OnConnectedFunction) self.OnConnectedFunction(connection);
            done();
        }).fail(function (error) {
            _connected = false;
            console.log(error);
            fail();
        })

        connection.error(function (error) {
            _connected = false;
            console.log("SignalR error: " + error);
        })
    }

    self._doTransaction = function (message) {
        if (!self._connected)
            self._connect(function () {
                self._remoteHub.invoke("send", self.controllerName, self.locationId, JSON.stringify(message));
            }, function () { if(self.OnErrorFunction) self.OnErrorFunction("Error connecting."); });
        else {
            self._remoteHub.invoke("send", self.controllerName, self.locationId, JSON.stringify(message));
        }
    }

    self.answerYesFunction = function () {
        var yesMessage = { Action: "Answer", Success: true };
        self._doTransaction(yesMessage);
    }

    self.answerNoFunction = function () {
        var noMessage = { Action: "Answer", Success: false };
        self._doTransaction(noMessage);
    }

    self.creditSaleFunction = function (deviceName, amount, accountNumber, billingName, expDate, cvv, street, zip) {
        var csMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({TransactionType: "CreditSale", Amount:amount, AccountNumber: accountNumber, BillingName: billingName, ExpDate: expDate, CVV: cvv, Street: street, Zip: zip, DeviceName: deviceName})
        };
        self._doTransaction(csMessage);
    }

    self.creditReturnFunction = function (deviceName, amount) {
        var crMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({ TransactionType: "CreditReturn", Amount: amount, DeviceName: deviceName })
        };
        self._doTransaction(crMessage);
    }

    self.creditAuthFunction = function (deviceName, amount, accountNumber, billingName, expDate, cvv, street, zip) {
        var caMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({ TransactionType: "CreditAuth", Amount: amount, AccountNumber: accountNumber, BillingName: billingName, ExpDate: expDate, CVV: cvv, Street: street, Zip: zip, DeviceName: deviceName })
        };
        self._doTransaction(caMessage);
    }

    self.creditForceFunction = function (deviceName, amount, authCode, uniqueTransRef) {
        var cfMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({ TransactionType: "CreditForce", Amount: amount, DeviceName: deviceName, VoiceAuthCode: authCode, UniqueTransRef: uniqueTransRef })
        };
        self._doTransaction(cfMessage);
    }

    self.creditAddTipFunction = function (deviceName, amount, uniqueTransRef) {
        var catMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({ TransactionType: "CreditAddTip", Amount: amount, DeviceName: deviceName, UniqueTransRef: uniqueTransRef })
        };
        self._doTransaction(catMessage);
    }

    self.saveCreditCardFunction = function (deviceName, accountNumber, billingName, expDate, cvv, street, zip) {
        var sccMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({ TransactionType: "CreditSaveCard", Amount: "0.05", AccountNumber: accountNumber, BillingName: billingName, ExpDate: expDate, CVV: cvv, Street: street, Zip: zip, DeviceName: deviceName })
        };
        self._doTransaction(sccMessage);
    }

    self.debitSaleFunction = function (deviceName, amount) {
        var dsMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({ TransactionType: "DebitSale", Amount: amount, DeviceName: deviceName })
        };
        self._doTransaction(dsMessage);
    }

    self.echoFunction = function (message) {
        var eMessage = { Action: "Echo", Data: message };
        self._doTransaction(eMessage);
    }

    self.voidFunction = function (deviceName, uniqueTransRef) {
        var vMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({ TransactionType: "Void", UniqueTransRef: uniqueTransRef, DeviceName: deviceName })
        };
        self._doTransaction(vMessage);
    }

    self.requestSignatureFunction = function (deviceName) {
        var rsMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({ TransactionType: "RequestSignature", DeviceName: deviceName })
        };
        self._doTransaction(rsMessage);
    }

    self.displayTextFunction = function (deviceName, displayText) {
        var dtMessage = {
            Action: "Transaction", TestMode: self.isTestMode, Data: JSON.stringify({ TransactionType: "DisplayText", DeviceName: deviceName, DisplayText: displayText })
        };
        self._doTransaction(dtMessage);
    }

    self.cancelFunction = function (deviceName) {
        var cancelMessage = { Action: "CancelTransaction", TestMode: self.isTestMode, Data: JSON.stringify({ DeviceName: deviceName }) };
        self._doTransaction(cancelMessage);
    }

    self.downloadConfiguration = function (locationId) {
        if (!locationId) return;
        var url;
        if (self.isTestMode) {
            url = "https://api-staging.chargeitpro.com/RemoteConfig/";
        } else {
            url = "https://api.chargeitpro.com/RemoteConfig/";
        }
        $.ajax({
            url: url + locationId,
            headers: { "Content-Type": "application/json" }
        }).done(function (data) {
            if (data.Success === true) {
                self.controllerName = data.Result.ControllerName;
                self.devices = data.Result.Devices;
                if (!self.OnConfigurationDownloadedFunction) {
                    alert("Configuration successfully downloaded.");
                    return;
                }
                self.devices.sort(function (a, b) {
                    if (a.DeviceName < b.DeviceName) return -1;
                    if (a.DeviceName > b.DeviceName) return 1;
                    return 0;
                });
                if (self.OnConfigurationDownloadedFunction) self.OnConfigurationDownloadedFunction();
            }
        }).fail(function (error) {
            alert("Unable to download configuration.");
        });
    }
})();